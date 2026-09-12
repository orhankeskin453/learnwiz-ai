# LearWizAI — Step 6 Plan: Learn Mode, Practice & Quiz

Spec (binding): docs/superpowers/specs/2026-09-12-step6-learn-practice-quiz-design.md
Execution: controller-implemented, single comprehensive review at step close.
Ledger: .superpowers/sdd/2026-09-12-step6-learn-practice-quiz/progress.md.

## Tasks

- **T1**: migration 0004 (lessons, quizzes, quiz_questions, quiz_attempts).
- **T2**: contracts — types (Lesson, LessonBlock, PracticeQuestion, QuizSummary/
  Attempt, QuotaState reuse) + validation (topicSchema, learnSchema, practiceSchema,
  quizSchema, attemptSchema, lessonContentSchema + questionSchema for AI output).
- **T3**: `services/ai/generate.ts` — strict-JSON extraction (fence stripping),
  zod validation, router-level fallback on failure; entitlements extension
  (shared Free pool across task types, quiz 5/month, guest per-feature limits).
- **T4**: routes `learn.ts` (POST lessons, GET list/:id), `practice.ts` (POST set),
  `quiz.ts` (POST generate, POST /:id/attempts server-scored, GET list/:id).
- **T5**: UI — LearnPage/PracticePage/QuizPage, namespaces learn/practice/quiz
  (en/tr), routes swap, services.
- **T6**: tests (fixtures valid/malformed JSON, entitlement matrix, scoring,
  ownership) + gates + commit + deploy + real-AI smoke (lesson, practice, quiz).
- **T7**: comprehensive review → fixes → ledger closure.

## Global constraints

Strict-JSON only after zod validation (§10.6); no unvalidated AI content rendered;
all copy en/tr; mock-AI fixtures in tests only; no new runtime deps.
