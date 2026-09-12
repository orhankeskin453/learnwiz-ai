import { z } from "zod";
import type { Feature, Locale } from "@learwizai/types";

/**
 * Supported UI locales (CLAUDE.md §6).
 *
 * Compile-time locking uses TWO mechanisms:
 * 1. `satisfies` rejects a schema WIDENED beyond `Locale`.
 * 2. `LocaleLock` forcing function rejects when `Locale` gains values the
 *    schema doesn't accept (bidirectional protection).
 */
export const localeSchema = z.enum(["en", "tr"]) satisfies z.ZodType<Locale>;

type SchemaLocale = z.infer<typeof localeSchema>;

/**
 * Bidirectional drift lock: `satisfies` alone only rejects a schema widened
 * beyond `Locale`. This forcing function fails `pnpm typecheck` when EITHER
 * side drifts — e.g. `Locale` gaining "de" (CLAUDE.md §34) without the schema
 * following, or the schema narrowing below `Locale`.
 */
type LocaleLock = [SchemaLocale] extends [Locale]
  ? [Locale] extends [SchemaLocale]
    ? true
    : { error: "Locale has values localeSchema does not accept" }
  : { error: "localeSchema accepts values outside Locale" };

/** Compile-time assertion; exported so no-unused-vars lint stays quiet. */
export const localeLock: LocaleLock = true;

export type { Locale };

/** Guest-feature capability enum (CLAUDE.md §5.1) — contract-locked to `Feature`. */
export const featureSchema = z.enum([
  "ai_tutor",
  "learn_mode",
  "practice",
  "quiz",
]) satisfies z.ZodType<Feature>;

type SchemaFeature = z.infer<typeof featureSchema>;

/**
 * Bidirectional drift lock for `Feature` — same forcing function as
 * `localeSchema`: fails `pnpm typecheck` when either side drifts.
 */
type FeatureLock = [SchemaFeature] extends [Feature]
  ? [Feature] extends [SchemaFeature]
    ? true
    : { error: "Feature has values featureSchema does not accept" }
  : { error: "featureSchema accepts values outside Feature" };

/** Compile-time assertion; exported so no-unused-vars lint stays quiet. */
export const featureLock: FeatureLock = true;

/** Email identity — normalized (trimmed, lowercased) before persistence (§40.3). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Password policy (§40.10): strong-but-usable — length bound, no composition rules. */
export const passwordSchema = z.string().min(10).max(128);

/** 64-char hex auth token (256-bit random, delivered via email links). */
export const authTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = z.object({ token: authTokenSchema });

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetConfirmSchema = z.object({ token: authTokenSchema, password: passwordSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** §10.3 tutor actions — contract-locked to the shared `TutorAction` type. */
export const tutorActionSchema = z.enum([
  "chat",
  "explain",
  "simplify",
  "give_example",
  "quiz_me",
  "give_exercise",
  "summarize",
]) satisfies z.ZodType<import("@learwizai/types").TutorAction>;

export const chatSchema = z.object({
  conversationId: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  message: z.string().trim().min(1).max(2000),
  action: tutorActionSchema.optional(),
  locale: localeSchema,
});

export const topicSchema = z.string().trim().min(1).max(120);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const learnRequestSchema = z.object({ topic: topicSchema, locale: localeSchema });

export const practiceRequestSchema = z.object({
  topic: topicSchema,
  count: z.number().int().min(3).max(10).default(3),
  locale: localeSchema,
});

export const quizRequestSchema = z.object({
  topic: topicSchema,
  difficulty: difficultySchema,
  count: z.union([z.literal(3), z.literal(5), z.literal(10)]),
  locale: localeSchema,
});

export const attemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)),
});

/** ---- AI output schemas (§10.6: validate BEFORE presenting) ---- */

const blockText = z.string().min(1).max(4000);

export const lessonContentSchema = z.object({
  title: z.string().min(1).max(120),
  blocks: z.tuple([
    z.object({ kind: z.literal("concept"), content: blockText }),
    z.object({ kind: z.literal("intuition"), content: blockText }),
    z.object({ kind: z.literal("example"), content: blockText }),
    z.object({ kind: z.literal("common_mistakes"), content: blockText }),
    z.object({ kind: z.literal("mini_exercise"), content: blockText }),
    z.object({
      kind: z.literal("check_understanding"),
      content: blockText,
      question: z.string().min(1).max(500),
      answer: z.string().min(1).max(1000),
    }),
  ]),
});

export const questionSchema = z.object({
  question: z.string().min(1).max(500),
  options: z
    .array(z.string().min(1).max(200))
    .length(4)
    .refine((opts) => new Set(opts).size === 4, { message: "options must be unique" }),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(1000),
});

export const questionSetSchema = z.object({
  questions: z.array(questionSchema).min(1).max(10),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;
export type QuestionSet = z.infer<typeof questionSetSchema>;
