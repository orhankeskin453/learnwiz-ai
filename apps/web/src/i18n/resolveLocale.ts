import type { Locale } from "@learwizai/types";
import { localeSchema } from "@learwizai/validation";

/** Where locale hints come from; kept injectable so resolution is unit-testable. */
export interface LocaleSources {
  /** Value of the `learwiz_locale` cookie, if any. */
  cookieValue?: string | null;
  /** Value of the `learwiz_locale` localStorage key, if any. */
  storedValue?: string | null;
  /** `navigator.languages` (or `[navigator.language]`). */
  browserLanguages?: readonly string[];
}

/**
 * Locale resolution precedence (CLAUDE.md §6.3, pre-auth slice):
 * explicit guest selection (cookie, then storage) -> browser language -> "en".
 * The authenticated-user tier is added by the auth step (spec §6.3).
 */
export function resolveLocale(sources: LocaleSources): Locale {
  for (const candidate of [sources.cookieValue, sources.storedValue]) {
    if (!candidate) continue;
    const parsed = localeSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  for (const language of sources.browserLanguages ?? []) {
    const base = language.toLowerCase().split("-")[0];
    const parsed = localeSchema.safeParse(base);
    if (parsed.success) return parsed.data;
  }
  return "en";
}
