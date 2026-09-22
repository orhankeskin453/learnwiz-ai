import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionRunner } from "@/components/learning/QuestionRunner";
import { GenerationProgress } from "@/components/learning/GenerationProgress";
import { learningErrorKind, type LearningErrorKind } from "@/components/learning/errors";
import { ApiError } from "@/services/apiClient";
import { generatePractice } from "@/services/tutor";
import { getActiveLocale } from "@/i18n";
import type { PracticeQuestion } from "@learwizai/types";

/** Practice Mode (CLAUDE.md §10.5): Question X of Y with instant feedback. */
export function PracticePage() {
  const { t } = useTranslation("practice");
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LearningErrorKind | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [finished, setFinished] = useState<{ score: number; total: number } | null>(null);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await generatePractice({
        topic: topic.trim(),
        count: 3,
        locale: getActiveLocale(),
      });
      setQuestions(response.questions);
    } catch (err) {
      setError(err instanceof ApiError ? learningErrorKind(err) : "generic");
    } finally {
      setLoading(false);
    }
  }

  if (questions && finished) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{t("summary.title")}</h1>
        </header>
        <section className="rounded-lg border border-border bg-card p-6">
          <p className="text-lg font-medium text-foreground">
            {t("summary.score", { score: finished.score, total: finished.total })}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              setQuestions(null);
              setFinished(null);
              setTopic("");
            }}
          >
            {t("start")}
          </Button>
        </section>
      </div>
    );
  }

  if (questions) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </header>
        <section className="rounded-lg border border-border bg-card p-6">
          <QuestionRunner
            questions={questions}
            instantFeedback
            namespace="practice"
            onFinish={(answers) => {
              const score = questions.reduce(
                (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
                0,
              );
              setFinished({ score, total: questions.length });
            }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form onSubmit={submit} className="max-w-md space-y-4">
        <div className="grid gap-2">
          <label htmlFor="practice-topic" className="text-sm font-medium text-foreground">
            {t("topicLabel")}
          </label>
          <Input
            id="practice-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("topicPlaceholder")}
            maxLength={120}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || topic.trim().length === 0}>
          {loading ? t("starting") : t("start")}
        </Button>
        {loading && (
          <GenerationProgress
            stages={[t("progress.stage1"), t("progress.stage2"), t("progress.stage3")]}
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error === "limit"
              ? t("errors.limit")
              : error === "quota"
                ? t("errors.quota")
                : error === "unavailable"
                  ? t("errors.unavailable")
                  : t("errors.generic")}
          </p>
        )}
      </form>
    </div>
  );
}
