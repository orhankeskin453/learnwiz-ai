/**
 * Dashboard + progress aggregates (CLAUDE.md §10.2, §10.8) — owner-scoped,
 * single-round queries; guests see their session's temporary data (§32).
 */
import type { QuotaState } from "@learwizai/types";
import { randomHex } from "./sessionCrypto";
import type { ConversationOwner as Owner } from "./ai/conversations";
import { GUEST_ENTITLEMENTS, FREE_DAILY_AI_LIMIT } from "./entitlements";

export interface DashboardData {
  continueLearning: { id: string; title: string; updatedAt: string } | null;
  recentLessons: Array<{ id: string; topic: string; createdAt: string }>;
  quiz: { attempts: number; avgMastery: number } | null;
  topics: Array<{ topic: string; mastery: number }>;
  aiUsage: QuotaState;
}

export interface ProgressData {
  topics: Array<{
    topic: string;
    mastery: number;
    totalQuestions: number;
    correctQuestions: number;
  }>;
}

export async function getDashboard(db: D1Database, owner: Owner): Promise<DashboardData> {
  const ownerUser = owner.userId;
  const ownerGuest = owner.guestSessionId;

  const [conversation, lessons, quizStats, topics, usage] = await Promise.all([
    db
      .prepare(
        "SELECT id, title, updated_at FROM conversations WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY updated_at DESC LIMIT 1",
      )
      .bind(ownerUser, ownerGuest)
      .first<{ id: string; title: string; updated_at: string } | null>(),
    db
      .prepare(
        "SELECT id, topic, created_at FROM lessons WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY created_at DESC LIMIT 3",
      )
      .bind(ownerUser, ownerGuest)
      .all<{ id: string; topic: string; created_at: string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS attempts, AVG(qa.score * 1.0 / qa.total) AS avg FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
         WHERE q.owner_user_id IS ? AND q.owner_guest_session_id IS ? AND q.kind = 'quiz'`,
      )
      .bind(ownerUser, ownerGuest)
      .first<{ attempts: number; avg: number | null } | null>(),
    db
      .prepare(
        "SELECT topic, mastery FROM topic_mastery WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY updated_at DESC LIMIT 3",
      )
      .bind(ownerUser, ownerGuest)
      .all<{ topic: string; mastery: number }>(),
    getAiUsage(db, owner),
  ]);

  return {
    continueLearning: conversation
      ? {
          id: conversation.id,
          title: conversation.title || "…",
          updatedAt: conversation.updated_at,
        }
      : null,
    recentLessons: lessons.results.map((r) => ({
      id: r.id,
      topic: r.topic,
      createdAt: r.created_at,
    })),
    quiz:
      quizStats && quizStats.attempts > 0
        ? { attempts: quizStats.attempts, avgMastery: quizStats.avg ?? 0 }
        : null,
    topics: topics.results.map((r) => ({ topic: r.topic, mastery: r.mastery })),
    aiUsage: usage,
  };
}

async function getAiUsage(db: D1Database, owner: Owner): Promise<QuotaState> {
  const { countUserAiUsageToday } = await import("./ai/usage");
  if (owner.userId) {
    return {
      used: await countUserAiUsageToday(db, owner.userId),
      limit: FREE_DAILY_AI_LIMIT,
      scope: "daily",
    };
  }
  // Guests: the tutor counter is a per-SESSION total (§5.1), not a daily window.
  if (!owner.guestSessionId) return { used: 0, limit: 0, scope: "session" };
  const { getGuestUsage } = await import("./guestSessions");
  const usage = await getGuestUsage(db, owner.guestSessionId);
  return { used: usage.ai_tutor, limit: GUEST_ENTITLEMENTS.ai_tutor, scope: "session" };
}

export async function getProgress(db: D1Database, owner: Owner): Promise<ProgressData> {
  const { results } = await db
    .prepare(
      "SELECT topic, mastery, total_questions, correct_questions FROM topic_mastery WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY mastery ASC LIMIT 20",
    )
    .bind(owner.userId, owner.guestSessionId)
    .all<{ topic: string; mastery: number; total_questions: number; correct_questions: number }>();
  return {
    topics: results.map((r) => ({
      topic: r.topic,
      mastery: r.mastery,
      totalQuestions: r.total_questions,
      correctQuestions: r.correct_questions,
    })),
  };
}

/** Upsert per-topic mastery after a server-scored quiz attempt (§10.8). */
export async function recordMastery(
  db: D1Database,
  owner: Owner,
  input: { topic: string; correct: number; total: number },
): Promise<void> {
  if (input.total <= 0) return;
  const normalized = input.topic.trim().toLowerCase();
  const existing = await db
    .prepare(
      "SELECT id, total_questions, correct_questions FROM topic_mastery WHERE owner_user_id IS ? AND owner_guest_session_id IS ? AND topic_normalized = ?",
    )
    .bind(owner.userId, owner.guestSessionId, normalized)
    .first<{ id: string; total_questions: number; correct_questions: number } | null>();

  const total = (existing?.total_questions ?? 0) + input.total;
  const correct = (existing?.correct_questions ?? 0) + input.correct;
  const mastery = total > 0 ? correct / total : 0;
  const now = new Date().toISOString();

  if (existing) {
    await db
      .prepare(
        "UPDATE topic_mastery SET total_questions = ?, correct_questions = ?, mastery = ?, updated_at = ? WHERE id = ?",
      )
      .bind(total, correct, mastery, now, existing.id)
      .run();
    return;
  }
  await db
    .prepare(
      "INSERT INTO topic_mastery (id, owner_user_id, owner_guest_session_id, topic_normalized, topic, total_questions, correct_questions, mastery, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      randomHex(16),
      owner.userId,
      owner.guestSessionId,
      normalized,
      input.topic.trim(),
      total,
      correct,
      mastery,
      now,
    )
    .run();
}
