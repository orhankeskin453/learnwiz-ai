import type { Locale } from "@learwizai/types";
import { type LocaleSources, resolveLocale } from "./resolveLocale";

export const LOCALE_COOKIE = "learwiz_locale";
const STORAGE_KEY = "learwiz_locale";
const ONE_YEAR_SECONDS = 31_536_000;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function readStorage(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null; // storage blocked
  }
}

/** Gather real-browser inputs for resolveLocale(). */
export function readLocaleSources(): LocaleSources {
  return {
    cookieValue: readCookie(LOCALE_COOKIE),
    storedValue: readStorage(STORAGE_KEY),
    browserLanguages:
      typeof navigator === "undefined"
        ? []
        : (navigator.languages ?? [navigator.language]).filter((l): l is string => Boolean(l)),
  };
}

/** Persist an explicit guest locale choice (cookie authoritative + storage mirror). */
export function setLocalePreference(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR_SECONDS};SameSite=Lax`;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // cookie still records the choice
  }
}

/** Convenience: resolve from the live browser environment. */
export function resolveBrowserLocale(): Locale {
  return resolveLocale(readLocaleSources());
}
