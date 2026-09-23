import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getProgress, type ProgressTopic } from "@/services/dashboard";

/** Progress (§10.8): per-topic mastery, weak areas, recommended review. */
export function ProgressPage() {
  const { t } = useTranslation("progress");
  const { locale = "en" } = useParams();
  const [topics, setTopics] = useState<ProgressTopic[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getProgress();
        if (!cancelled) setTopics(data.topics);
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (topics === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{t("title")}</h1>
        <div className="space-y-3" aria-busy="true">
          <div className="h-16 w-full animate-pulse rounded-[16px] bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-[16px] bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => (
            <div key={topic.topic} className="rounded-[16px] border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{topic.topic}</p>
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  {t("mastery", { percent: Math.round(topic.mastery * 100) })}
                </span>
              </div>
              <Progress
                value={topic.mastery * 100}
                aria-label={t("mastery", { percent: Math.round(topic.mastery * 100) })}
                className="mt-3 h-1.5 bg-muted"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("questions", { correct: topic.correctQuestions, total: topic.totalQuestions })}
              </p>
            </div>
          ))}
          <div className="rounded-[16px] border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">{t("weakAreas")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics
                .filter((topic) => topic.mastery < 0.8)
                .map((topic) => (
                  <Button key={topic.topic} type="button" variant="outline" size="sm" asChild>
                    <Link to={`/${locale}/practice?topic=${encodeURIComponent(topic.topic)}`}>
                      {t("practiceCta", { topic: topic.topic })}
                    </Link>
                  </Button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
