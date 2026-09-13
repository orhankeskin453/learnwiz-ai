import type enDashboard from "./locales/en/dashboard.json";
import type enProgress from "./locales/en/progress.json";
import type enDocuments from "./locales/en/documents.json";
import type enAuth from "./locales/en/auth.json";
import type enCommon from "./locales/en/common.json";
import type enNav from "./locales/en/nav.json";
import type enLearn from "./locales/en/learn.json";
import type enPractice from "./locales/en/practice.json";
import type enQuiz from "./locales/en/quiz.json";
import type enStyleguide from "./locales/en/styleguide.json";
import type enTutor from "./locales/en/tutor.json";
import enDashboardJson from "./locales/en/dashboard.json";
import enProgressJson from "./locales/en/progress.json";
import enDocumentsJson from "./locales/en/documents.json";
import enAuthJson from "./locales/en/auth.json";
import enCommonJson from "./locales/en/common.json";
import enNavJson from "./locales/en/nav.json";
import enLearnJson from "./locales/en/learn.json";
import enPracticeJson from "./locales/en/practice.json";
import enQuizJson from "./locales/en/quiz.json";
import enStyleguideJson from "./locales/en/styleguide.json";
import enTutorJson from "./locales/en/tutor.json";
import trDashboardJson from "./locales/tr/dashboard.json";
import trProgressJson from "./locales/tr/progress.json";
import trDocumentsJson from "./locales/tr/documents.json";
import trAuthJson from "./locales/tr/auth.json";
import trCommonJson from "./locales/tr/common.json";
import trNavJson from "./locales/tr/nav.json";
import trLearnJson from "./locales/tr/learn.json";
import trPracticeJson from "./locales/tr/practice.json";
import trQuizJson from "./locales/tr/quiz.json";
import trStyleguideJson from "./locales/tr/styleguide.json";
import trTutorJson from "./locales/tr/tutor.json";

/** Locale-independent list of supported locales (CLAUDE.md §6). */
export const SUPPORTED_LOCALES = ["en", "tr"] as const;

/** Namespace names shipped so far; later steps add their own (spec §6.1). */
export const NAMESPACES = [
  "auth",
  "common",
  "dashboard",
  "nav",
  "progress",
  "styleguide",
  "tutor",
  "learn",
  "practice",
  "quiz",
] as const;

export const resources = {
  en: {
    auth: enAuthJson,
    common: enCommonJson,
    dashboard: enDashboardJson,
    nav: enNavJson,
    progress: enProgressJson,
    styleguide: enStyleguideJson,
    tutor: enTutorJson,
    learn: enLearnJson,
    practice: enPracticeJson,
    quiz: enQuizJson,
  },
  tr: {
    auth: trAuthJson,
    common: trCommonJson,
    dashboard: trDashboardJson,
    nav: trNavJson,
    progress: trProgressJson,
    styleguide: trStyleguideJson,
    tutor: trTutorJson,
    learn: trLearnJson,
    practice: trPracticeJson,
    quiz: trQuizJson,
  },
} as const;

/** English resource shape — the source of truth for typed keys. */
export type EnResources = {
  auth: typeof enAuth;
  documents: typeof enDocuments;
  dashboard: typeof enDashboard;
  progress: typeof enProgress;
  common: typeof enCommon;
  nav: typeof enNav;
  styleguide: typeof enStyleguide;
  tutor: typeof enTutor;
  learn: typeof enLearn;
  practice: typeof enPractice;
  quiz: typeof enQuiz;
};
