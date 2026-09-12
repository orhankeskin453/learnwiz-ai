import { Hono } from "hono";
import { quizRequestSchema, questionSetSchema } from "@learwizai/validation";
import type { AppEnv } from "../context";
import type { QuizGenerationResponse } from "@learwizai/types";
import { AiUnavailableError, generateStructured } from "../services/ai/generate";
import { buildQuizMessages } from "../services/ai/prompts";
import { recordAiUsage } from "../services/ai/usage";
import {
  getOwnedQuizQuestions,
  listOwnedQuizzes,
  saveQuiz,
  saveQuizAttempt,
} from "../services/learning";
import { recordGuestUsage } from "../services/guestSessions";
import { enforceAiBudget } from "../middleware/aiBudget";
import { ownerOf } from "./learn";

/** Quiz Generator (CLAUDE.md §10.6): generate → validate → take → server-score. */
export const quizRoute = new Hono<AppEnv>();

quizRoute.post("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const parsed = quizRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const budget = await enforceAiBudget(c, "quiz", 1);
  if (budget) return budget;

  const { topic, difficulty, count, locale } = parsed.data;
  let generated;
  try {
    generated = await generateStructured(c.env, {
      messages: buildQuizMessages(topic, difficulty, count, locale),
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
    kind: "quiz",
    topic,
    difficulty,
    locale,
    questions: generated.data.questions,
  });
  await recordAiUsage(c.env.DB, {
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    model: generated.model,
    taskType: "quiz",
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
    await recordGuestUsage(c.env.DB, identity.sessionId, "quiz");
  }
  const body: QuizGenerationResponse = { quizId, questions: generated.data.questions };
  return c.json(body);
});

/** Server-scored attempt (§16): client answers are never trusted for scoring. */
quizRoute.post("/:id/attempts", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const parsed = (await import("@learwizai/validation")).attemptSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid answers" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const owner = ownerOf(c);
  const quiz = await getOwnedQuizQuestions(c.env.DB, c.req.param("id"), owner);
  if (!quiz || quiz.kind !== "quiz") {
    return c.json({ error: "not_found" } satisfies { error: "not_found" }, 404);
  }
  const answers = parsed.data.answers;
  const score = quiz.questions.reduce(
    (acc, question, index) => acc + (answers[index] === question.answer ? 1 : 0),
    0,
  );
  await saveQuizAttempt(c.env.DB, c.req.param("id"), score, quiz.questions.length, answers);
  return c.json({ score, total: quiz.questions.length });
});

quizRoute.get("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  return c.json(await listOwnedQuizzes(c.env.DB, ownerOf(c)));
});

quizRoute.get("/:id", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const quiz = await getOwnedQuizQuestions(c.env.DB, c.req.param("id"), ownerOf(c));
  if (!quiz) {
    return c.json({ error: "not_found" } satisfies { error: "not_found" }, 404);
  }
  return c.json(quiz);
});
