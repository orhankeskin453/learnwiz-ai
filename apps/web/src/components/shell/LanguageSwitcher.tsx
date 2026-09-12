import type { Locale } from "@learwizai/types";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { setLocalePreference } from "@/i18n/localePrefs";

// Native language names are locale-invariant proper nouns (documented
// exception to the no-hardcoded-strings rule, same as the brand name).
const LABELS: Record<Locale, string> = { en: "English", tr: "Türkçe" };

/** EN↔TR toggle: persists the choice (§6.3 tier 2) and swaps the route locale. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const current: Locale = locale === "tr" ? "tr" : "en";
  const next: Locale = current === "en" ? "tr" : "en";

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("language.switchAria", { language: LABELS[next] })}
      onClick={() => {
        setLocalePreference(next);
        const rest = pathname.replace(/^\/(?:en|tr)(?=\/|$)/, "");
        navigate(`/${next}${rest}${search}`);
      }}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{LABELS[next]}</span>
    </Button>
  );
}
