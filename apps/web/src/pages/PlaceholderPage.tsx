import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/states/empty-state";

export const PLACEHOLDER_SECTIONS = [
  "dashboard",
  "tutor",
  "learn",
  "practice",
  "quizzes",
  "documents",
  "progress",
  "settings",
] as const;

export type PlaceholderSection = (typeof PLACEHOLDER_SECTIONS)[number];

const TITLE_KEYS = {
  dashboard: "placeholders.dashboard.title",
  tutor: "placeholders.tutor.title",
  learn: "placeholders.learn.title",
  practice: "placeholders.practice.title",
  quizzes: "placeholders.quizzes.title",
  documents: "placeholders.documents.title",
  progress: "placeholders.progress.title",
  settings: "placeholders.settings.title",
} as const satisfies Record<PlaceholderSection, string>;

const DESCRIPTION_KEYS = {
  dashboard: "placeholders.dashboard.description",
  tutor: "placeholders.tutor.description",
  learn: "placeholders.learn.description",
  practice: "placeholders.practice.description",
  quizzes: "placeholders.quizzes.description",
  documents: "placeholders.documents.description",
  progress: "placeholders.progress.description",
  settings: "placeholders.settings.description",
} as const satisfies Record<PlaceholderSection, string>;

/** Localized "arrives in a later step" surface for each nav destination (§29). */
export function PlaceholderPage({ section }: { section: PlaceholderSection }) {
  const { t } = useTranslation("nav");
  return <EmptyState title={t(TITLE_KEYS[section])} description={t(DESCRIPTION_KEYS[section])} />;
}
