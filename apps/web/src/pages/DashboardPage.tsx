import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/services/dashboard";
import { getActiveLocale } from "@/i18n";
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
        const d = await getDashboard(getActiveLocale());
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
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">{t("continueLearning.title")}</h1>
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          {t(`greeting.${greetingKey(new Date())}`)}
        </h1>
      </header>

      {data === null ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("continueLearning.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.continueLearning ? (
                <>
                  <p className="text-sm text-muted-foreground">{data.continueLearning.title}</p>
                  <Button type="button" size="sm" asChild>
                    <Link to="tutor">{t("continueLearning.resume")}</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("continueLearning.empty")}</p>
                  <Button type="button" size="sm" asChild>
                    <Link to="tutor">{t("continueLearning.resume")}</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("recentLessons.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.recentLessons.length === 0 ? (
                  <p className="text-muted-foreground">{t("recentLessons.empty")}</p>
                ) : (
                  data.recentLessons.map((l) => (
                    <Link
                      key={l.id}
                      to="learn"
                      className="block rounded-md px-2 py-1 hover:bg-accent"
                    >
                      {l.topic}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("quizStats.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {data.quiz ? (
                  <>
                    <p>{t("quizStats.attempts", { count: data.quiz.attempts })}</p>
                    <p>{t("quizStats.avg", { percent: Math.round(data.quiz.avgMastery * 100) })}</p>
                  </>
                ) : (
                  <p>{t("recentLessons.empty")}</p>
                )}
                <p className="pt-2">
                  {t("usage.label", { used: data.aiUsage.used, limit: data.aiUsage.limit })}
                </p>
              </CardContent>
            </Card>
          </div>

          {data.topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("topics.title")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.topics.map((topic) => (
                  <span
                    key={topic.topic}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                  >
                    {topic.topic}
                  </span>
                ))}
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link to="progress">{t("progressCta")}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
