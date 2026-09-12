import { useTranslation } from "react-i18next";

/** Design-system showcase (§40.7 QA surface). Expanded in Task 8. */
export function StyleGuidePage() {
  const { t } = useTranslation("styleguide");
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
