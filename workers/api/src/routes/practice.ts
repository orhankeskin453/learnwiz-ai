import { Hono } from "hono";
import { practiceRequestSchema, questionSetSchema } from "@learwizai/validation";
import type { AppEnv } from "../context";
import type { QuizGenerationResponse } from "@learwizai/types";
import { AiUnavailableError, generateStructured } from "../services/ai/generate";
import { buildPracticeMessages } from "../services/ai/prompts";
import { recordAiUsage } from "../services/ai/usage";
import { saveQuiz } from "../services/learning";
import { recordGuestUsage } from "../services/guestSessions";
import { enforceAiBudget } from "../middleware/aiBudget";
import { ownerOf } from "./learn";

/** Practice Mode (CLAUDE.md §10.5): a small MCQ set with instant feedback. */
export const practiceRoute = new Hono<AppEnv>();

practiceRoute.post("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const parsed = practiceRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  // Guests consume QUESTIONS (§5.1: 3 questions); one 3-question session = 3 units.
  const budget = await enforceAiBudget(c, "practice", parsed.data.count);
  if (budget) return budget;

  const { topic, count, locale } = parsed.data;
  let generated;
  try {
    generated = await generateStructured(c.env, {
      messages: buildPracticeMessages(topic, count, locale),
      schema: questionSetSchema,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return c.json({ error: "ai_unavailable" } satisfies { error: "ai_unavailable" }, 503);
    }
    throw error;
  }

  const owner = ownerOf(c);
  const quizId = await saveQuiz(c.env.DB, owner, {
    kind: "practice",
    topic,
    difficulty: "medium",
    locale,
    questions: generated.data.questions,
  });
  await recordAiUsage(c.env.DB, {
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    model: generated.model,
    taskType: "practice",
    inputTokens: generated.usage.promptTokens,
    outputTokens: generated.usage.completionTokens,
    neurons: generated.usage.neurons ?? null,
    latencyMs: null,
    plan: identity.kind === "guest" ? "guest" : "free",
    locale,
    routedFallback: generated.fallback,
    usageEstimated: false,
    requestId: c.get("requestId"),
  });
  if (identity.kind === "guest") {
    await recordGuestUsage(c.env.DB, identity.sessionId, "practice", count);
  }
  const body: QuizGenerationResponse = { quizId, questions: generated.data.questions };
  return c.json(body);
});
