# LearWizAI — Step 9: Guest Migration & Dashboard/Progress Design Spec

Binding authority for Step 9 (CLAUDE.md §48 item 9). Implements §5.2 (guest → user
migration, full content), §10.2 (dashboard), §10.8 (progress), §16 (topic_mastery).
Admin Dashboard remains POSTPONED (2026-09-12 decision).

## 1. Scope

IN:

- **Full guest content migration**: conversations, lessons, quizzes (attempts ride
  with their quiz) repointed from guest_session to user at verification AND at login
  (guest cookie present), via one D1 batch, guarded by migration_status='pending'
  (idempotent, §5.2).
- **Authenticated dashboard** (`/{locale}` replaces the placeholder): greeting,
  Continue Learning (latest conversation), recent lessons, quiz stats, today's AI
  usage vs the identity's limit, top topics. Backed by `GET /api/dashboard`.
- **Progress page** (`/{locale}/progress`): per-topic mastery bars, weak areas,
  recommended review (→ practice CTA with the topic preselected). Backed by
  `GET /api/progress`; mastery accumulates server-side on every quiz attempt.
- `dashboard` + `progress` namespaces (en/tr, §6.2).

OUT: recommendations engine beyond "weakest topic" (§48 item 9 keeps Phase 3 adaptive
learning out), lesson_progress/enrollments course model, localStorage continuation
snapping, admin dashboards (postponed), progress for practice-mode sets (only
kind='quiz' attempts count toward mastery — practice stays a no-stakes sandbox).

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                         | Rationale                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D1  | Migration = one `db.batch([UPDATE conversations…, UPDATE lessons…, UPDATE quizzes…, UPDATE guest_sessions SET migration_status='migrated'…])` — atomic in D1; the batch ONLY runs when migration_status='pending' (read first; raced signups re-run harmlessly because the UPDATEs are idempotent by owner key). Guest usage counters do NOT transfer (they are guest entitlement state, §5.2 "do not migrate temporary state"). | §5.2 transactional + idempotent; D1 batch = one transaction.     |
| D2  | Migration triggers: (a) verify-email (existing hook, now full), (b) login with an active guest cookie. Login also runs it because users often try features as guests THEN log in on another day.                                                                                                                                                                                                                                 | §5.2 "On signup or login".                                       |
| D3  | `topic_mastery(id, owner_user_id XOR owner_guest_session_id, topic, total_questions, correct_questions, mastery REAL, updated_at)` — UPSERT on (owner, topic lowercase): total += quiz size, correct += score, mastery = correct/total (0..1). Quiz attempts with 0 questions skipped. Practice sets don't affect mastery (no stakes).                                                                                           | §16 topic_mastery; §10.8 simple, explainable mastery.            |
| D4  | `GET /api/dashboard` (identity required): `{ continueLearning: {id, title, updatedAt}                                                                                                                                                                                                                                                                                                                                            | null, recentLessons: [≤3], quiz: {attempts, avgMastery}          | null, topics: [≤3 by mastery asc? — newest first], aiUsage: {used, limit} }`— all owner-scoped aggregates; guests get their session's data (§32 "temporary").`GET /api/progress`: `{ topics: [{topic, mastery, totalQuestions, correctQuestions}] asc by mastery }`. | §10.2/§10.8 content; single-round aggregation. |
| D5  | Dashboard UI: greeting (time-of-day via i18n key, no name yet — email optional), Continue Learning card (→ /tutor which resumes the latest conversation), Recent lessons list (→ /learn), AI usage hint (reuses QuotaState), top-topics chips; Progress CTA. Progress UI: mastery bars (percent), weak-area list with "Practice {{topic}}" buttons linking to `/practice?topic=…`; PracticePage reads `?topic=` prefill.         | §10.2 "what should the learner do next"; §10.8; §29 no KPI wall. |
| D6  | PracticePage gains `useSearchParams` prefill (topic). Quiz attempts already POST — mastery upsert happens inside the attempt handler AFTER scoring (same D1 batch is unnecessary; two statements fine).                                                                                                                                                                                                                          | Server authority for progress (§40.4).                           |
| D7  | Tests: migration integration (guest conversation+lesson+quiz → verify → all repointed, guest migrated, user dashboard sees them; second verification = no-op), login-path migration, mastery accumulation across two attempts (weighted average), dashboard/progress payloads, guest dashboard sees own session data.                                                                                                            | §47.16-adjacent matrix for migration.                            |

## 3. Definition of Done (Step 9)

1. Migration 0005 applied local + remote ×3; deployed staging + production.
2. Real-migration smoke on staging: guest generates content → register/verify →
   content owned by the user (dashboard lists it), guest session marked migrated.
3. Dashboard + Progress pages live (en/tr), states per §36.
4. Gates green; comprehensive review dispatched; ledger closed with dispositions.
