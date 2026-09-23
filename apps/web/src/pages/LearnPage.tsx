import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { learningErrorKind, type LearningErrorKind } from "@/components/learning/errors";
import { GenerationProgress } from "@/components/learning/GenerationProgress";
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
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">{lesson.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{lessonTopic}</p>
        </header>

        <div className="rounded-[16px] border border-border bg-card p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums tracking-[0.1em] text-muted-foreground">
              {String(blockIndex + 1).padStart(2, "0")}
              <span aria-hidden="true">/{String(lesson.blocks.length).padStart(2, "0")}</span>
            </span>
            <Badge variant="secondary">{t(`blocks.${kind}`)}</Badge>
            <span className="ml-auto shrink-0 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
              {Math.round(((blockIndex + 1) / lesson.blocks.length) * 100)}%
            </span>
          </div>
          <div className="flex gap-1" role="presentation">
            {lesson.blocks.map((b, i) => (
              <span
                key={`${b.kind}-${i}`}
                className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                  i < blockIndex ? "bg-primary/60" : i === blockIndex ? "bg-primary" : "bg-muted/70"
                }`}
              />
            ))}
          </div>
          <Progress
            value={((blockIndex + 1) / lesson.blocks.length) * 100}
            aria-label={t(`blocks.${kind}`)}
            className="sr-only"
          />
        </div>

        <section
          aria-label={t(`blocks.${kind}`)}
          className="min-h-48 space-y-4 rounded-[20px] border border-border bg-card p-6 md:p-7"
        >
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
            {block.content}
          </p>
          {block.question && (
            <div className="space-y-3 rounded-xl border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-semibold text-foreground">{block.question}</p>
              {/* Degraded lessons (model omitted the answer) hide the reveal instead
                  of showing an empty one — see normalizeLessonContent. */}
              {block.answer ? (
                revealed ? (
                  <p className="text-sm text-muted-foreground">{block.answer}</p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealed(true)}
                  >
                    {t("showAnswer")}
                  </Button>
                )
              ) : null}
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
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form
        onSubmit={submit}
        className="max-w-md space-y-5 rounded-[20px] border border-border bg-card p-6"
      >
        <div className="grid gap-2">
          <label htmlFor="learn-topic" className="text-sm font-semibold text-foreground">
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
        {loading && (
          <GenerationProgress
            stages={[
              t("progress.stage1"),
              t("progress.stage2"),
              t("progress.stage3"),
              t("progress.stage4"),
            ]}
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
