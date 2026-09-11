import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/states/empty-state";

export function NotFoundPage() {
  const { t } = useTranslation("nav");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <EmptyState title={t("notFound.title")} description={t("notFound.description")} />
    </main>
  );
}
