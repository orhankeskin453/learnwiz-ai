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
