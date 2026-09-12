import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionRunner } from "@/components/learning/QuestionRunner";
import { learningErrorKind, type LearningErrorKind } from "@/components/learning/errors";
import { ApiError } from "@/services/apiClient";
import { generateQuiz, submitQuizAttempt } from "@/services/tutor";
import { getActiveLocale } from "@/i18n";
import type { PracticeQuestion, QuizDifficulty } from "@learwizai/types";

/** Quiz Generator (CLAUDE.md §10.6): config → generate → take → server-scored. */
export function QuizPage() {
  const { t } = useTranslation("quiz");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LearningErrorKind | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await generateQuiz({
        topic: topic.trim(),
        difficulty,
        count,
        locale: getActiveLocale(),
      });
      setQuestions(response.questions);
      setQuizId(response.quizId);
    } catch (err) {
      setError(err instanceof ApiError ? learningErrorKind(err) : "generic");
    } finally {
      setLoading(false);
    }
  }

  async function finish(answers: number[]): Promise<void> {
    if (!quizId) return;
    try {
      setResult(await submitQuizAttempt(quizId, answers));
    } catch {
      // Scoring is best-effort for the UI; still show a completion screen.
      setResult({ score: -1, total: answers.length });
    }
  }

  if (questions && result) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{t("summary.title")}</h1>
        </header>
        <section className="rounded-lg border border-border bg-card p-6">
          <p className="text-lg font-medium text-foreground">
            {result.score >= 0
              ? t("summary.score", { score: result.score, total: result.total })
              : t("summary.title")}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              setQuestions(null);
              setResult(null);
              setQuizId(null);
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
            instantFeedback={false}
            namespace="quiz"
            onFinish={finish}
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
          <label htmlFor="quiz-topic" className="text-sm font-medium text-foreground">
            {t("topicLabel")}
          </label>
          <Input
            id="quiz-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("topicPlaceholder")}
            maxLength={120}
            disabled={loading}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="quiz-difficulty" className="text-sm font-medium text-foreground">
            {t("difficultyLabel")}
          </label>
          <Select
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as QuizDifficulty)}
          >
            <SelectTrigger id="quiz-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t("difficulties.easy")}</SelectItem>
              <SelectItem value="medium">{t("difficulties.medium")}</SelectItem>
              <SelectItem value="hard">{t("difficulties.hard")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <label htmlFor="quiz-count" className="text-sm font-medium text-foreground">
            {t("countLabel")}
          </label>
          <Select value={String(count)} onValueChange={(value) => setCount(Number(value))}>
            <SelectTrigger id="quiz-count">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading || topic.trim().length === 0}>
          {loading ? t("generating") : t("start")}
        </Button>
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
