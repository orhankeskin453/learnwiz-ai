import { z } from "zod";
import type { Locale } from "@learwizai/types";

/**
 * Supported UI locales (CLAUDE.md §6). The `satisfies` clause keeps this
 * schema and the shared `Locale` type in sync at compile time — if either
 * side drifts, `pnpm typecheck` fails (contract testing per §40.6).
 */
export const localeSchema = z.enum(["en", "tr"]) satisfies z.ZodType<Locale>;

export type { Locale };
