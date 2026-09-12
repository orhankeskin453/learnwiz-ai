/**
 * AI usage ledger (CLAUDE.md §14) + Free-plan daily window (§10.10).
 * One row per AI call; cost columns stay null until the billing step.
 */
import { randomHex } from "../sessionCrypto";
import type { Locale } from "@learwizai/types";

export interface AiUsageEntry {
  userId: string | null;
  guestSessionId: string | null;
  model: string;
  taskType: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  neurons: number | null;
  plan: "guest" | "free" | "learner" | "pro";
  locale: Locale;
  routedFallback: boolean;
  usageEstimated: boolean;
  requestId?: string;
}

export async function recordAiUsage(db: D1Database, entry: AiUsageEntry): Promise<string> {
  const id = randomHex(16);
  await db
    .prepare(
      `INSERT INTO ai_usage
        (id, user_id, guest_session_id, model, task_type, input_tokens, output_tokens,
         neurons, latency_ms, plan, locale, routed_fallback, usage_estimated, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      entry.userId,
      entry.guestSessionId,
      entry.model,
      entry.taskType,
      entry.inputTokens,
      entry.outputTokens,
      entry.neurons,
      entry.latencyMs,
      entry.plan,
      entry.locale,
      entry.routedFallback ? 1 : 0,
      entry.usageEstimated ? 1 : 0,
      entry.requestId ?? null,
      new Date().toISOString(),
    )
    .run();
  return id;
}

/** Fill in the actual token counts once the stream has drained (§13.6). */
export async function updateAiUsageTokens(
  db: D1Database,
  id: string,
  inputTokens: number | null,
  outputTokens: number | null,
  usageEstimated: boolean,
  latencyMs: number | null,
): Promise<void> {
  await db
    .prepare(
      "UPDATE ai_usage SET input_tokens = ?, output_tokens = ?, usage_estimated = ?, latency_ms = ? WHERE id = ?",
    )
    .bind(inputTokens, outputTokens, usageEstimated ? 1 : 0, latencyMs, id)
    .run();
}

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/** Free-plan daily AI count (§10.10: 10/day) — ledger-driven, resets at UTC midnight. */
export async function countUserAiUsageToday(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND task_type = 'tutor' AND created_at >= ?",
    )
    .bind(userId, startOfUtcDay())
    .first<{ n: number }>();
  return row?.n ?? 0;
}
