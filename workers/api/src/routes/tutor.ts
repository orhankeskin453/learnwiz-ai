import { Hono, type Context } from "hono";
import type { ChatResponse, ConversationDetail, QuotaState } from "@learwizai/types";
import { chatSchema } from "@learwizai/validation";
import type { AppEnv } from "../context";
import { enforceWindow } from "../services/rateLimit";
import {
  addMessage,
  createConversation,
  getOwnedConversation,
  getRecentMessages,
  listConversations,
  type ConversationOwner,
} from "../services/ai/conversations";
import { buildSystemPrompt, titleFromMessage } from "../services/ai/prompts";
import { runTutorCompletion } from "../services/ai/router";
import { countUserAiUsageToday, recordAiUsage } from "../services/ai/usage";
import {
  FREE_DAILY_AI_LIMIT,
  GUEST_ENTITLEMENTS,
  isUnlimited,
  ledgerPlan,
} from "../services/entitlements";
import { getGuestUsage, recordGuestUsage } from "../services/guestSessions";
import { clientIp } from "../middleware/identity";
import type { ChatMessage } from "../services/ai/client";

/**
 * AI Tutor routes (CLAUDE.md §10.3, §33): identity → throttle → entitlement →
 * validate → AI (single fallback) → persist + ledger + respond. v1 is
 * non-streaming: exact §13.6 token accounting happens synchronously.
 */
export const tutorRoute = new Hono<AppEnv>();

const GUEST_AI_LIMIT = GUEST_ENTITLEMENTS.ai_tutor;

function ownerOf(c: Context<AppEnv>): ConversationOwner {
  const identity = c.get("identity");
  return identity.kind === "user"
    ? { userId: identity.userId, guestSessionId: null }
    : { userId: null, guestSessionId: identity.kind === "guest" ? identity.sessionId : null };
}

tutorRoute.post("/chat", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }

  // Admin accounts bypass the coarse IP throttle (unlimited testing access).
  if (!isUnlimited(c.get("identity"))) {
    const throttle = await enforceWindow(
      c.env.CACHE,
      { bucket: "tutor-chat", key: clientIp(c), max: 20, windowSeconds: 3600 },
      c.env.GUEST_SESSION_SECRET ?? "tutor-throttle-pepper",
    );
    if (!throttle) {
      return c.json({ error: "rate_limited" } satisfies { error: "rate_limited" }, 429);
    }
  }

  const parsed = chatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const { conversationId, message, action = "chat", locale } = parsed.data;

  // §33 ordering: entitlement gate BEFORE any AI work. Admins are unlimited.
  if (!isUnlimited(identity) && identity.kind === "guest") {
    const usage = await getGuestUsage(c.env.DB, identity.sessionId);
    if (usage.ai_tutor >= GUEST_AI_LIMIT) {
      return c.json(
        { error: "ai_limit_reached", message: "guest quota exhausted" } satisfies {
          error: "ai_limit_reached";
          message?: string;
        },
        403,
      );
    }
  } else if (identity.kind === "user" && !isUnlimited(identity)) {
    const usedToday = await countUserAiUsageToday(c.env.DB, identity.userId);
    if (usedToday >= FREE_DAILY_AI_LIMIT) {
      return c.json(
        { error: "ai_limit_reached", message: "daily free quota exhausted" } satisfies {
          error: "ai_limit_reached";
          message?: string;
        },
        403,
      );
    }
  }

  // Conversation resolve/create with strict ownership (§40.7).
  const owner = ownerOf(c);
  let conversationIdUsed: string;
  if (conversationId) {
    const existing = await getOwnedConversation(c.env.DB, conversationId, owner);
    if (!existing) {
      return c.json(
        { error: "conversation_not_found" } satisfies { error: "conversation_not_found" },
        404,
      );
    }
    conversationIdUsed = existing.id;
  } else {
    conversationIdUsed = await createConversation(
      c.env.DB,
      owner,
      locale,
      titleFromMessage(message),
    );
  }

  const history = await getRecentMessages(c.env.DB, conversationIdUsed);
  await addMessage(c.env.DB, conversationIdUsed, "user", action, message);

  const context: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(action, locale) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const startedAt = Date.now();
  let completion: Awaited<ReturnType<typeof runTutorCompletion>>;
  try {
    completion = await runTutorCompletion(c.env, context);
  } catch {
    return c.json({ error: "ai_unavailable" } satisfies { error: "ai_unavailable" }, 503);
  }

  // §13.6/§33: exact usage accounting, synchronously with the response.
  await addMessage(c.env.DB, conversationIdUsed, "assistant", action, completion.text);
  await recordAiUsage(c.env.DB, {
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    model: completion.model,
    taskType: "tutor",
    inputTokens: completion.usage.promptTokens,
    outputTokens: completion.usage.completionTokens,
    neurons: completion.usage.neurons ?? null,
    latencyMs: Date.now() - startedAt,
    plan: ledgerPlan(identity),
    locale,
    routedFallback: completion.fallback,
    usageEstimated: !completion.usageProvided,
    requestId: c.get("requestId"),
  });
  if (identity.kind === "guest") {
    await recordGuestUsage(c.env.DB, identity.sessionId, "ai_tutor");
  }

  const body: ChatResponse = {
    conversationId: conversationIdUsed,
    assistantMessage: completion.text,
    usage: {
      inputTokens: completion.usage.promptTokens,
      outputTokens: completion.usage.completionTokens,
      fallback: completion.fallback,
    },
  };
  return c.json(body);
});

tutorRoute.get("/quota", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  if (identity.kind === "guest") {
    const used = (await getGuestUsage(c.env.DB, identity.sessionId)).ai_tutor;
    const body: QuotaState = { used, limit: GUEST_AI_LIMIT };
    return c.json(body);
  }
  if (isUnlimited(identity)) {
    const body: QuotaState = { used: 0, limit: 0, unlimited: true };
    return c.json(body);
  }
  const body: QuotaState = {
    used: await countUserAiUsageToday(c.env.DB, identity.userId),
    limit: FREE_DAILY_AI_LIMIT,
  };
  return c.json(body);
});

tutorRoute.get("/conversations", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  return c.json(await listConversations(c.env.DB, ownerOf(c)));
});

tutorRoute.get("/conversations/:id", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const owner = ownerOf(c);
  const conversation = await getOwnedConversation(c.env.DB, c.req.param("id"), owner);
  if (!conversation) {
    return c.json(
      { error: "conversation_not_found" } satisfies { error: "conversation_not_found" },
      404,
    );
  }
  const body: ConversationDetail = {
    ...conversation,
    messages: await getRecentMessages(c.env.DB, conversation.id, 100),
  };
  return c.json(body);
});
