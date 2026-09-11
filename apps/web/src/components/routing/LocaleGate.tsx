import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router";
import type { Locale } from "@learwizai/types";
import { localeSchema } from "@learwizai/validation";
import i18n from "@/i18n";
import { syncHreflang } from "@/i18n/head";
import { resolveBrowserLocale } from "@/i18n/localePrefs";

/**
 * Validates :locale against the shared contract schema and syncs the active
 * locale into i18next, <html lang> and hreflang/canonical head links.
 */
export function LocaleGate() {
  const { locale } = useParams();
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) {
    return <Navigate to={`/${resolveBrowserLocale()}`} replace />;
  }
  return <LocaleSync locale={parsed.data} />;
}

function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    syncHreflang(locale);
  }, [locale]);
  return <Outlet />;
}
