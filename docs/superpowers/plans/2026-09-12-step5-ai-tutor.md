# LearWizAI — Step 5 Plan: AI Tutor, AI Router & Usage Accounting

Spec (binding): docs/superpowers/specs/2026-09-12-step5-ai-tutor-design.md
Execution: controller-implemented, single comprehensive review at step close.
Ledger: .superpowers/sdd/2026-09-12-step5-ai-tutor/progress.md.

## Tasks

- **T1 — Infra**: migration 0003 (`conversations`, `messages`, `ai_usage` — §14/§16
  field set), `ai: { binding: "AI" }` in wrangler.jsonc, Env additions
  (`AI`, `AI_PRIMARY_MODEL?`, `AI_FALLBACK_MODEL?`), vitest mock AI binding.
- **T2 — Contracts**: types (`TutorAction`, `ChatRequest`, SSE frame shapes,
  `ConversationSummary`, `TutorMessage`, new ApiErrorCode `ai_limit_reached`);
  validation `chatSchema` (message 1..2000, action enum, locale) + `actionSchema`
  contract-locked.
- **T3 — AI services**: `services/ai/router.ts` (primary + single fallback),
  `services/ai/prompts.ts` (persona + 6 action prefixes + language interpolation),
  `services/ai/usage.ts` (ledger writer, day-window count for users, guest
  decrement).
- **T4 — Routes**: `routes/tutor.ts` — POST /chat (entitlement gate → conversation
  resolve/create → user message persist → AI stream w/ usage capture → waitUntil
  accounting), GET /conversations, GET /conversations/:id (owner-scoped). Mount.
- **T5 — Tutor UI**: `tutor` namespace (en/tr), `TutorPage.tsx` (chat + action
  chips + streaming + states), routes.tsx swap, `services/tutor.ts` stream client,
  page test.
- **T6 — Tests + gates**: unit (prompts, router, daily window), integration
  (guest 3→403, user window, ownership isolation, ledger row, SSE shape), UI test.
  typecheck/lint/test/build/format.
- **T7 — Closure**: remote migrations ×3, deploy staging+production, REAL AI smoke
  (one guest chat on staging + ledger row check), comprehensive review, ledger.

## Global constraints

- No blind AI retries — single fallback only (§18). No model names exposed in UI
  copy (§29). Prompts treat user input as untrusted content (§19 injection rule).
- No new runtime deps. All user-visible strings in `tutor` namespace (en+tr).
