import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { learningErrorKind, type LearningErrorKind } from "@/components/learning/errors";
import { ApiError } from "@/services/apiClient";
import { generateLesson } from "@/services/tutor";
import { getActiveLocale } from "@/i18n";
import type { Lesson } from "@learwizai/types";

/** Learn Mode (CLAUDE.md §10.4): a structured lesson, taught block by block. */
export function LearnPage() {
  const { t } = useTranslation("learn");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LearningErrorKind | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonTopic, setLessonTopic] = useState("");
  const [blockIndex, setBlockIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await generateLesson({ topic: topic.trim(), locale: getActiveLocale() });
      setLesson(response.lesson);
      setLessonTopic(topic.trim());
      setBlockIndex(0);
      setRevealed(false);
    } catch (err) {
      setError(err instanceof ApiError ? learningErrorKind(err) : "generic");
    } finally {
      setLoading(false);
    }
  }

  if (lesson) {
    const block = lesson.blocks[blockIndex]!;
    const kind = block.kind;
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">{lesson.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{lessonTopic}</p>
        </header>

        <Progress
          value={((blockIndex + 1) / lesson.blocks.length) * 100}
          aria-label={t(`blocks.${kind}`)}
        />

        <section
          aria-label={t(`blocks.${kind}`)}
          className="min-h-48 space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <Badge variant="secondary">{t(`blocks.${kind}`)}</Badge>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{block.content}</p>
          {block.question && (
            <div className="space-y-2 rounded-md border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">{block.question}</p>
              {revealed ? (
                <p className="text-sm text-muted-foreground">{block.answer}</p>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setRevealed(true)}>
                  {t("showAnswer")}
                </Button>
              )}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blockIndex === 0}
            onClick={() => {
              setBlockIndex(blockIndex - 1);
              setRevealed(false);
            }}
          >
            {t("previous")}
          </Button>
          {blockIndex === lesson.blocks.length - 1 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setLesson(null);
                setTopic("");
              }}
            >
              {t("newLesson")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setBlockIndex(blockIndex + 1);
                setRevealed(false);
              }}
            >
              {t("next")}
            </Button>
          )}
        </div>
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
          <label htmlFor="learn-topic" className="text-sm font-medium text-foreground">
            {t("topicLabel")}
          </label>
          <Input
            id="learn-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("topicPlaceholder")}
            maxLength={120}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || topic.trim().length === 0}>
          {loading ? t("generating") : t("generate")}
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
