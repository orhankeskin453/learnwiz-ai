import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PracticeQuestion } from "@learwizai/types";

export interface RunnerLabels {
  questionOf: string;
  check: string;
  next: string;
  finish: string;
  correct: string;
  incorrect: string;
  explanation: string;
}

interface QuestionRunnerProps {
  questions: PracticeQuestion[];
  /** Practice Mode reveals correctness after checking; Quiz Mode only scores at the end. */
  instantFeedback: boolean;
  /** Namespace whose runner.* labels apply (practice | quiz). */
  namespace: "practice" | "quiz";
  onFinish: (answers: number[]) => void;
}

/** Shared §10.5/§10.6 question flow: select → check (practice) → next → results. */
export function QuestionRunner({
  questions,
  instantFeedback,
  namespace,
  onFinish,
}: QuestionRunnerProps) {
  const { t } = useTranslation(namespace);
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  const question = questions[index]!;
  const selected = selections[index] ?? null;
  const isLast = index === questions.length - 1;

  function select(optionIndex: number): void {
    if (instantFeedback && checked) return; // locked after checking
    const next = [...selections];
    next[index] = optionIndex;
    setSelections(next);
  }

  function proceed(): void {
    if (instantFeedback && !checked) {
      setChecked(true);
      return;
    }
    if (isLast) {
      onFinish(questions.map((_, i) => selections[i] ?? -1));
      return;
    }
    setIndex(index + 1);
    setChecked(false);
  }

  const showFeedback = instantFeedback && checked;
  const canProceed = selected !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {t("runner.questionOf", { index: index + 1, total: questions.length })}
        </p>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>
      <p className="text-lg font-semibold leading-7 text-foreground">{question.question}</p>

      <div className="grid gap-2" role="radiogroup" aria-label={question.question}>
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          const isCorrect = optionIndex === question.answer;
          const revealCorrect = showFeedback && isCorrect;
          const revealWrong = showFeedback && isSelected && !isCorrect;
          return (
            <button
              key={optionIndex}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => select(optionIndex)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                revealCorrect && "border-success bg-success/10 text-foreground",
                revealWrong && "border-destructive bg-destructive/10 text-foreground",
                !revealCorrect && !revealWrong && isSelected
                  ? "border-primary bg-primary/10 text-foreground"
                  : !revealCorrect && !revealWrong
                    ? "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    : "",
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 font-mono text-xs text-muted-foreground"
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span className="flex-1">{option}</span>
            </button>
          );
        })}
      </div>

      {showFeedback && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3",
            selected === question.answer
              ? "border-success/30 bg-success/10"
              : "border-destructive/30 bg-destructive/10",
          )}
        >
          <p
            className={cn(
              "text-sm font-semibold",
              selected === question.answer ? "text-success" : "text-destructive",
            )}
          >
            {selected === question.answer ? t("runner.correct") : t("runner.incorrect")}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("runner.explanation")} {question.explanation}
          </p>
        </div>
      )}

      <Button type="button" onClick={proceed} disabled={!canProceed}>
        {instantFeedback
          ? checked
            ? isLast
              ? t("runner.finish")
              : t("runner.next")
            : t("runner.check")
          : isLast
            ? t("runner.finish")
            : t("runner.next")}
      </Button>
    </div>
  );
}
