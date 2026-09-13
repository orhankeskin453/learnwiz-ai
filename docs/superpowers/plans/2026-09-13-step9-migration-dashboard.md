# LearWizAI — Step 9 Plan: Guest Migration & Dashboard/Progress

Spec (binding): docs/superpowers/specs/2026-09-13-step9-migration-dashboard-design.md
Execution: controller-implemented, single comprehensive review at step close.
Ledger: .superpowers/sdd/2026-09-13-step9-migration-dashboard/progress.md.

- **T1**: migration 0005 (topic_mastery); `services/migration.ts` (batch repoint).
- **T2**: verify-email + login hooks call full migration; mastery upsert in the
  quiz attempt handler (learning.ts helpers).
- **T3**: `services/dashboard.ts` (aggregates) + routes `dashboard.ts`
  (GET /api/dashboard, GET /api/progress).
- **T4**: UI — DashboardPage (replaces index placeholder), ProgressPage (replaces
  progress placeholder), dashboard+progress namespaces (en/tr), PracticePage
  ?topic= prefill, routes swap.
- **T5**: tests (migration, mastery, payloads) + gates + commit + deploy.
- **T6**: real-migration smoke on staging + comprehensive review + ledger closure.
