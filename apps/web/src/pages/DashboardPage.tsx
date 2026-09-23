import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/services/dashboard";
import type { DashboardData } from "@learwizai/types";

function greetingKey(date: Date): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Dashboard (§10.2): what should the learner do next? */
export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = await getDashboard();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="space-y-5">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          {t("continueLearning.title")}
        </h1>
        <p role="alert" className="text-sm text-destructive">
          {t("continueLearning.empty")}
        </p>
        <Button type="button" asChild>
          <Link to="tutor">{t("continueLearning.resume")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          {t(`greeting.${greetingKey(new Date())}`)}
        </h1>
        {data && (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground"
            aria-label={t("usage.label", { used: data.aiUsage.used, limit: data.aiUsage.limit })}
          >
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {t("usage.label", { used: data.aiUsage.used, limit: data.aiUsage.limit })}
          </span>
        )}
      </header>

      {data === null ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-32 w-full rounded-[20px]" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 w-full rounded-[20px]" />
            <Skeleton className="h-40 w-full rounded-[20px]" />
          </div>
        </div>
      ) : (
        <>
          <Card className="rounded-[20px] border-border/80 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t("continueLearning.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pb-6">
              <p className="max-w-md text-[15px] leading-6 text-muted-foreground">
                {data.continueLearning ? data.continueLearning.title : t("continueLearning.empty")}
              </p>
              <Button type="button" size="sm" asChild>
                <Link to="tutor">{t("continueLearning.resume")}</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-[20px] border-border/80">
              <CardHeader>
                <CardTitle>{t("recentLessons.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {data.recentLessons.length === 0 ? (
                  <p className="text-muted-foreground">{t("recentLessons.empty")}</p>
                ) : (
                  data.recentLessons.map((l) => (
                    <Link
                      key={l.id}
                      to="learn"
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-foreground/90 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {l.topic}
                      <span className="text-xs text-muted-foreground" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="rounded-[20px] border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle>{t("quizStats.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-5 text-sm">
                  {data.quiz ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">
                          {t("quizStats.attempts", { count: data.quiz.attempts })}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {Math.round(data.quiz.avgMastery * 100)}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={t("quizStats.avg", {
                          percent: Math.round(data.quiz.avgMastery * 100),
                        })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(data.quiz.avgMastery * 100)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${Math.round(data.quiz.avgMastery * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("quizStats.avg", { percent: Math.round(data.quiz.avgMastery * 100) })}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t("quizStats.empty")}</p>
                  )}
                  <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {t("usage.label", { used: data.aiUsage.used, limit: data.aiUsage.limit })}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[20px] border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle>{t("topics.title")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 pb-5">
                  {data.topics.map((topic) => (
                    <span
                      key={topic.topic}
                      className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {topic.topic}
                    </span>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    className="ml-auto text-primary hover:text-primary"
                  >
                    <Link to="progress">{t("progressCta")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
