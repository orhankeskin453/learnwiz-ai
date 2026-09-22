import { Hono, type Context } from "hono";
import { learnRequestSchema, lessonContentSchema } from "@learwizai/validation";
import type { AppEnv } from "../context";
import { ledgerPlan } from "../services/entitlements";
import { AiUnavailableError, generateStructured } from "../services/ai/generate";
import { buildLessonMessages } from "../services/ai/prompts";
import { recordAiUsage } from "../services/ai/usage";
import { getOwnedLesson, listOwnedLessons, saveLesson, type Owner } from "../services/learning";
import { recordGuestUsage } from "../services/guestSessions";
import { enforceAiBudget } from "../middleware/aiBudget";

/** Learn Mode (CLAUDE.md §10.4): one structured lesson per topic. */
export const learnRoute = new Hono<AppEnv>();

export function ownerOf(c: Context<AppEnv>): Owner {
  const identity = c.get("identity");
  return identity.kind === "user"
    ? { userId: identity.userId, guestSessionId: null }
    : { userId: null, guestSessionId: identity.kind === "guest" ? identity.sessionId : null };
}

learnRoute.post("/lessons", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const parsed = learnRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const budget = await enforceAiBudget(c, "learn", 1);
  if (budget) return budget;

  const { topic, locale } = parsed.data;
  const startedAt = Date.now();
  let generated;
  try {
    generated = await generateStructured(c.env, {
      messages: buildLessonMessages(topic, locale),
      schema: lessonContentSchema,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return c.json({ error: "ai_unavailable" } satisfies { error: "ai_unavailable" }, 503);
    }
    throw error;
  }

  const owner = ownerOf(c);
  const lessonId = await saveLesson(c.env.DB, owner, { topic, locale, content: generated.data });
  await recordAiUsage(c.env.DB, {
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    model: generated.model,
    taskType: "learn",
    inputTokens: generated.usage.promptTokens,
    outputTokens: generated.usage.completionTokens,
    neurons: generated.usage.neurons ?? null,
    latencyMs: Date.now() - startedAt,
    plan: ledgerPlan(identity),
    locale,
    routedFallback: generated.fallback,
    usageEstimated: false,
    requestId: c.get("requestId"),
  });
  if (identity.kind === "guest") {
    await recordGuestUsage(c.env.DB, identity.sessionId, "learn_mode");
  }
  return c.json({ lessonId, lesson: generated.data });
});

learnRoute.get("/lessons", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  return c.json(await listOwnedLessons(c.env.DB, ownerOf(c)));
});

learnRoute.get("/lessons/:id", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const lesson = await getOwnedLesson(c.env.DB, c.req.param("id"), ownerOf(c));
  if (!lesson) {
    return c.json({ error: "not_found" } satisfies { error: "not_found" }, 404);
  }
  return c.json(lesson);
});
