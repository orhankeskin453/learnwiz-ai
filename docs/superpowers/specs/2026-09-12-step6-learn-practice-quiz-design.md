# LearWizAI — Step 6: Learn Mode, Practice & Quiz Design Spec

Binding authority for Step 6. Implements CLAUDE.md §10.4 (Learn Mode), §10.5
(Practice), §10.6 (Quiz Generator), §16 (quizzes/questions/quiz_attempts tables),
§5.1 (guest limits), §32 (free entitlements), §48 item 8. Build on the Step 5 AI
layer (router, ledger, entitlements).

## 1. Scope

IN: three AI-generated learning features —

- **Learn Mode**: a structured lesson per topic with exactly the §10.4 sequence
  (concept → intuition → example → common mistakes → mini exercise → check
  understanding) rendered as navigable blocks (not a raw AI dump, §10.4).
- **Practice Mode**: a small MCQ set for a topic with instant client-side answer
  checking, feedback and per-question explanation (§10.5).
- **Quiz Generator**: topic/difficulty/count/locale → generated quiz, server-validated
  (§10.6), server-scored attempts persisted to `quiz_attempts` (§16 progress feed).
- Shared "structured generation" service: AI → strict JSON → zod-validated →
  persisted; malformed output triggers the §18 fallback model once, then 503.
- Entitlement enforcement: guest (learn 1 topic, practice 3 questions, quiz 1) and
  authenticated Free (shared 10 AI messages/day pool §10.10 + quiz 5/month §32).
- UI: LearnPage, PracticePage, QuizPage replacing their placeholder routes;
  namespaces `learn`, `practice`, `quiz` (§6.2).

OUT (deferred): lesson_progress/courses model (progress step), image questions and
voice (Phase 2), flashcards/spaced repetition (Phase 2 §3.2), question types beyond
MCQ (enum locked, extensible), cheat-proof practice delivery (answers ship to the
client for instant feedback — single-player learning UX; graded server-side checks
land with progress/assessment).

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rationale                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Structured generation contract: prompts demand STRICT JSON; the service strips markdown fences, extracts the outermost JSON object, validates with zod; validation failure or AI error → ONE attempt with the §18 fallback model → 503 `ai_unavailable`. Never show unvalidated content (§10.6).                                                                                                                                                                                   | §10.6 validation mandate; §18 single fallback.                                                                                                                                                                                                                                                                  |
| D2  | Lesson schema (zod): `{title (≤120), blocks: [concept, intuition, example, common_mistakes, mini_exercise, check_understanding]}` — the six §10.4 blocks in order; each block ≤4000 chars; `check_understanding` carries `{question, answer}`. Stored as JSON in `lessons.content`.                                                                                                                                                                                                | §10.4 exact sequence; D1-safe size.                                                                                                                                                                                                                                                                             |
| D3  | Practice/quiz question schema: `{question (≤500), options: exactly 4 unique non-empty, answer: 0..3, explanation (≤1000)}`; a set is `{questions: N× schema}` (N=3 guest practice, 3–10 configurable).                                                                                                                                                                                                                                                                             | §10.5/§10.6; MCQ-only v1 (enum locked, extensible).                                                                                                                                                                                                                                                             |
| D4  | Entitlements: guest counters per §5.1 — `learn_mode` 1, `practice` 3 (QUESTIONS; one 3-question session consumes 3), `quiz` 1 — via `guest_usage`. Authenticated Free: a SHARED 10/day AI-message pool (tutor + learn + practice + quiz generations; §10.10 "10 AI messages/day" read broadly) — `countUserAiUsageToday` extended to ALL task types — plus quiz 5/month (§32, UTC month ledger count). All numbers are entitlement CONFIGURATION (§5.1), tunable.                  | §5.1/§10.10/§32; single-pool keeps accounting simple; the broad reading of "AI messages" is recorded here as the chosen interpretation.                                                                                                                                                                         |
| D5  | Persistence (§16): `lessons(id, owner XOR, topic, locale, content JSON, created_at)`; `quizzes(id, owner XOR, kind 'quiz'                                                                                                                                                                                                                                                                                                                                                          | 'practice', topic, difficulty, locale, created_at)`; `quiz_questions(id, quiz_id, position, question, options JSON, answer, explanation)`; `quiz_attempts(id, quiz_id, owner XOR-mirror?, score, total, answers JSON, created_at)`. Attempts are server-scored (answers never trusted from client for scoring). | §16 tables; §47-style server authority. |
| D6  | Contract: `POST /api/learn/lessons {topic(1..120), locale}` → `{lessonId, lesson}`; `POST /api/practice {topic(1..120), count 3..10, locale}` → `{quizId, questions}` (answers included — see §1 OUT); `POST /api/quiz {topic, difficulty easy                                                                                                                                                                                                                                     | medium                                                                                                                                                                                                                                                                                                          | hard, count 3                           | 5   | 10, locale}`→`{quizId, questions}`; `POST /api/quiz/:id/attempts {answers: number[]}`→`{score, total}`; list/detail GETs owner-scoped. Errors: 403 `ai_limit_reached`/ feature-specific`quota_exhausted`codes reuse the envelope; 503`ai_unavailable`. | Extends the Step 3–5 envelope; §10.6 inputs. |
| D7  | UI (§10.4–§10.6): LearnPage = topic form → generating state → block-by-block lesson viewer (Prev/Next + block badges, check-understanding reveal); PracticePage = topic form → Question X of Y → option select → Check answer → feedback+explanation → Next → summary; QuizPage = config form (topic/difficulty/count/locale inherited) → quiz runner → score screen. Namespaces `learn/practice/quiz` en+tr; placeholder routes replaced; guest quota copy consistent with tutor. | §10.4–10.6 flows verbatim; §36 DoD states.                                                                                                                                                                                                                                                                      |
| D8  | Tests: mock-AI JSON fixtures per feature (valid + malformed), entitlement matrix per identity (guest per-feature, free pool + monthly quiz), schema rejection of malformed AI output (fallback exercised), quiz scoring incl. wrong/missing answers, ownership isolation.                                                                                                                                                                                                          | Deterministic CI (no neurons).                                                                                                                                                                                                                                                                                  |

## 3. Definition of Done (Step 6)

1. Migration 0004 applied local + remote ×3; deployed staging + production.
2. All endpoints enforce §2 D4 entitlements with ledger records; malformed AI output
   never reaches the client (fallback → 503 path tested).
3. Quiz attempts server-scored and persisted.
4. Three pages live with en/tr copy, loading/empty/error states, a11y (§25), no
   hardcoded strings (§37.3).
5. Real-AI smoke on staging: one lesson, one practice set, one quiz + attempt.
6. Gates green; comprehensive review dispatched; ledger closed with dispositions.
