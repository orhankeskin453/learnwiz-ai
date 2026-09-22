import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface GenerationProgressProps {
  /** Stage labels, already translated, in the order they should appear. */
  stages: string[];
  /** Milliseconds each stage stays before advancing (the last stage sticks). */
  intervalMs?: number;
}

/**
 * Staged progress for AI generation waits (perceived-latency work): the user
 * sees which phase the request is in plus elapsed seconds, instead of a single
 * static "preparing…" label. Stages are time-driven because the API returns one
 * complete payload (no partial results) — the copy is therefore honest about
 * "what the system is doing", not a fake per-block feed.
 */
export function GenerationProgress({ stages, intervalMs = 2200 }: GenerationProgressProps) {
  const { t } = useTranslation("common");
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setStage(0);
    setElapsed(0);
    const stageTimer = setInterval(
      () => setStage((current) => Math.min(current + 1, stages.length - 1)),
      intervalMs,
    );
    const secondTimer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => {
      clearInterval(stageTimer);
      clearInterval(secondTimer);
    };
  }, [stages.length, intervalMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-4 py-3"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary"
      />
      <span className="text-sm text-foreground">{stages[stage]}</span>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {t("states.elapsedSeconds", { count: elapsed })}
      </span>
    </div>
  );
}
