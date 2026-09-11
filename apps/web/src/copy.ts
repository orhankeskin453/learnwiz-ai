/**
 * TEMPORARY Step 1 placeholder copy.
 * Step 2 introduces the i18n foundation (CLAUDE.md §6) and this file is
 * replaced by apps/web/src/i18n/locales/{en,tr}/*.json. Do not grow it.
 */
export const STATUS_PAGE_COPY = {
  en: {
    title: "LearWizAI",
    subtitle: "Foundation status",
    loading: "Checking API…",
    apiOk: "API reachable",
    apiDown: "API unreachable",
    env: "Environment",
    db: "Database",
  },
  tr: {
    title: "LearWizAI",
    subtitle: "Temel durum",
    loading: "API kontrol ediliyor…",
    apiOk: "API erişilebilir",
    apiDown: "API erişilemiyor",
    env: "Ortam",
    db: "Veritabanı",
  },
} as const;
