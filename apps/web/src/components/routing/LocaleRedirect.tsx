import { Navigate } from "react-router";
import { resolveBrowserLocale } from "@/i18n/localePrefs";

/** "/" → "/{resolved}" per CLAUDE.md §6.3 (guest slice). */
export function LocaleRedirect() {
  return <Navigate to={`/${resolveBrowserLocale()}`} replace />;
}
