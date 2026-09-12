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

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function startOfUtcMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Free-plan daily AI count (§10.10: 10/day) — SHARED pool across all AI features
 * (tutor, learn, practice, quiz generations) per the Step 6 spec D4 reading.
 * Ledger-driven, resets at UTC midnight.
 */
export async function countUserAiUsageToday(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND created_at >= ?")
    .bind(userId, startOfUtcDay())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Free-plan quiz count in the current UTC month (§32: 5 quizzes/month). */
export async function countUserQuizUsageThisMonth(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND task_type = 'quiz' AND created_at >= ?",
    )
    .bind(userId, startOfUtcMonth())
    .first<{ n: number }>();
  return row?.n ?? 0;
}
