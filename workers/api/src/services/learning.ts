/**
 * Persistence for generated learning artifacts (CLAUDE.md §16): lessons, quizzes,
 * quiz questions and server-scored attempts — all owner-scoped (§40.7).
 */
import { randomHex } from "./sessionCrypto";
import type { Locale, PracticeQuestion, QuizDifficulty } from "@learwizai/types";
import type { LessonContent } from "@learwizai/validation";
import type { ConversationOwner } from "./ai/conversations";

export type Owner = ConversationOwner;

function nowIso(): string {
  return new Date().toISOString();
}

export async function saveLesson(
  db: D1Database,
  owner: Owner,
  input: { topic: string; locale: Locale; content: LessonContent },
): Promise<string> {
  const id = randomHex(16);
  await db
    .prepare(
      "INSERT INTO lessons (id, owner_user_id, owner_guest_session_id, topic, locale, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      owner.userId,
      owner.guestSessionId,
      input.topic,
      input.locale,
      JSON.stringify(input.content),
      nowIso(),
    )
    .run();
  return id;
}

export async function getOwnedLesson(db: D1Database, id: string, owner: Owner) {
  const row = await db
    .prepare(
      "SELECT id, topic, locale, content, created_at, owner_user_id, owner_guest_session_id FROM lessons WHERE id = ?",
    )
    .bind(id)
    .first<{
      id: string;
      topic: string;
      locale: Locale;
      content: string;
      created_at: string;
      owner_user_id: string | null;
      owner_guest_session_id: string | null;
    }>();
  if (
    !row ||
    row.owner_user_id !== owner.userId ||
    row.owner_guest_session_id !== owner.guestSessionId
  ) {
    return null;
  }
  return {
    id: row.id,
    topic: row.topic,
    locale: row.locale,
    content: JSON.parse(row.content) as LessonContent,
    createdAt: row.created_at,
  };
}

export async function listOwnedLessons(db: D1Database, owner: Owner) {
  const { results } = await db
    .prepare(
      "SELECT id, topic, locale, created_at FROM lessons WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(owner.userId, owner.guestSessionId)
    .all<{ id: string; topic: string; locale: Locale; created_at: string }>();
  return results.map((r) => ({
    id: r.id,
    topic: r.topic,
    locale: r.locale,
    createdAt: r.created_at,
  }));
}

export async function saveQuiz(
  db: D1Database,
  owner: Owner,
  input: {
    kind: "quiz" | "practice";
    topic: string;
    difficulty: QuizDifficulty;
    locale: Locale;
    questions: PracticeQuestion[];
  },
): Promise<string> {
  const quizId = randomHex(16);
  const at = nowIso();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO quizzes (id, owner_user_id, owner_guest_session_id, kind, topic, difficulty, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        quizId,
        owner.userId,
        owner.guestSessionId,
        input.kind,
        input.topic,
        input.difficulty,
        input.locale,
        at,
      ),
  ];
  input.questions.forEach((q, position) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO quiz_questions (id, quiz_id, position, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          randomHex(16),
          quizId,
          position,
          q.question,
          JSON.stringify(q.options),
          q.answer,
          q.explanation,
        ),
    );
  });
  await db.batch(statements);
  return quizId;
}

export async function getOwnedQuizQuestions(
  db: D1Database,
  quizId: string,
  owner: Owner,
): Promise<{
  topic: string;
  difficulty: QuizDifficulty;
  locale: Locale;
  questions: PracticeQuestion[];
} | null> {
  const quiz = await db
    .prepare(
      "SELECT id, topic, difficulty, locale, owner_user_id, owner_guest_session_id FROM quizzes WHERE id = ?",
    )
    .bind(quizId)
    .first<{
      id: string;
      topic: string;
      difficulty: QuizDifficulty;
      locale: Locale;
      owner_user_id: string | null;
      owner_guest_session_id: string | null;
    }>();
  if (
    !quiz ||
    quiz.owner_user_id !== owner.userId ||
    quiz.owner_guest_session_id !== owner.guestSessionId
  ) {
    return null;
  }
  const { results } = await db
    .prepare(
      "SELECT question, options, answer, explanation FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC",
    )
    .bind(quizId)
    .all<{ question: string; options: string; answer: number; explanation: string }>();
  return {
    topic: quiz.topic,
    difficulty: quiz.difficulty,
    locale: quiz.locale,
    questions: results.map((r) => ({
      question: r.question,
      options: JSON.parse(r.options) as string[],
      answer: r.answer,
      explanation: r.explanation,
    })),
  };
}

export async function saveQuizAttempt(
  db: D1Database,
  quizId: string,
  score: number,
  answers: number[],
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO quiz_attempts (id, quiz_id, score, total, answers, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(randomHex(16), quizId, score, answers.length, JSON.stringify(answers), nowIso())
    .run();
}
