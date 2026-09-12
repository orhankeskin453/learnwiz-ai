# LearWizAI — Step 5: AI Tutor, AI Router & Usage Accounting Design Spec

Binding authority for Step 5. Implements CLAUDE.md §13 (AI architecture), §14 (AI
usage ledger), §10.3 (AI Tutor product shape), §17 (entitlements), §33 (tutor request
flows), §48 item 7. Admin Dashboard remains postponed (2026-09-12 decision).

## 1. Scope

IN: AI Router (primary + fallback model, env-configurable), AI Tutor chat with the six
§10.3 learning actions + free chat, conversation/message persistence, streaming
response pass-through with usage capture, `ai_usage` ledger (§14), guest entitlement
decrement (3 total, §5.1) and authenticated Free-plan daily limit (10/day, §10.10),
Tutor UI page (chat, action chips, usage indicator, localized en/tr).

OUT: Voice/image tutor (Phase 2), small-model routing tasks (§13.3 — no classification
workload yet; router interface ready), document RAG (§48 item 10), prompt caching
tuning (§13.7 — note only), Learner/Pro plans (billing step), auth UI (4b).

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                | Rationale                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Workers AI binding `AI` in wrangler.jsonc (all envs). Models env-tunable: `AI_PRIMARY_MODEL` default `@cf/zai-org/glm-4.7-flash` (§13.2), `AI_FALLBACK_MODEL` default `@cf/meta/llama-3.1-8b-instruct-fast` (§18 failover).                                                                                                                                                                                                                             | §13.2 target model + §18 bounded failover; swap-able without code (§34 AIRouter).                                                                                                |
| D2  | AI Router v1: `route(task) → { model }` — tutor tasks go to primary; on AI error (429/5xx/network) ONE fallback attempt with the fallback model; no blind retries (§18). Fallback usage flagged `routed_fallback` in the ledger.                                                                                                                                                                                                                        | §13.1 + §18 "may route to an approved fallback model rather than repeatedly retrying".                                                                                           |
| D3  | Tutor actions: `chat` (default) + `explain`, `simplify`, `give_example`, `quiz_me`, `give_exercise`, `summarize` — each maps to a system-prompt prefix; persona rules shared (teacher, pedagogical, structured, honest about uncertainty §30, respond in the user's language §6.4). Prompts live in `services/ai/prompts.ts` (en base; response language forced by `{{language}}` from request locale).                                                 | §10.3 "not a generic chatbot"; §6.4 AI localization.                                                                                                                             |
| D4  | Streaming: chat endpoint returns SSE pass-through of Workers AI tokens. Usage capture: the worker parses streamed `data:` frames, extracts `usage` from the terminating frame when the model emits it, else records an ESTIMATED count (chars/4 heuristic) with `usage_estimated=true`. Post-stream accounting runs via `waitUntil`.                                                                                                                    | §10.3 "stream where practical" + §13.6 "record actual usage" reconciled: exact when available, flagged estimate when not.                                                        |
| D5  | `ai_usage` ledger row per AI call (§14 fields): user_id/guest_session_id (exactly one), model, task_type ('tutor'), input/output tokens, cached_tokens (null v1), neurons (null v1), estimated_cost (null v1), latency_ms, plan ('guest'                                                                                                                                                                                                                | 'free'), locale, routed_fallback, usage_estimated, created_at.                                                                                                                   | §14 exact field set; cost columns reserved for billing step. |
| D6  | Entitlement enforcement order (§33): identity → rate limit (KV 20/h/IP on chat) → entitlement check → validate → AI → stream → ledger + usage decrement (waitUntil). Guest: guest_usage.ai_tutor < 3. User (Free): ai_usage rows for (user, 'tutor', UTC day) < 10. 402-style response: 403 `ai_limit_reached` (machine code) with message; upgrade nudges are UI-side (§29 no aggressive popups).                                                      | §5.1, §10.10 Free quota, §33 ordering, §17 single gate.                                                                                                                          |
| D7  | Persistence: `conversations(id, owner_user_id?, owner_guest_session_id?, title, locale, created_at, updated_at)` + `messages(id, conversation_id, role user                                                                                                                                                                                                                                                                                             | assistant, action, content, created_at)`; exactly one owner (CHECK); ownership enforced on reads (§40.7 — no cross-user access). Context = last 10 messages of the conversation. | §16 core tables; §40.7 tenant isolation.                     |
| D8  | Contract: `POST /api/tutor/chat` `{conversationId?, message (1..2000), action?, locale}` → SSE stream of `data: {"delta": "…"}` frames + final `data: {"done": true, "messageId", "usage": {…}}`; errors BEFORE stream start are JSON (403/429/400); `GET /api/tutor/conversations` + `GET /api/tutor/conversations/:id` owner-scoped.                                                                                                                  | Typed contract for the SPA stream reader; JSON-before-stream keeps error handling simple client-side.                                                                            |
| D9  | Tutor UI (`/…/tutor`, replaces placeholder route): action chips (§10.3 labels from `tutor` namespace), message list (user/assistant bubbles), streaming text append, input + send, remaining-quota hint (from guest session status / 403 body), EmptyState for new conversation, localized errors (403 ai_limit_reached → quota copy + signup nudge). No conversation picker in v1 — latest conversation resumes (list endpoint ships for 4b/settings). | §10.3 structure; §36 DoD (responsive, localized, loading/empty/error states); §29 guardrails.                                                                                    |
| D10 | Tests: mock `AI` binding injected via miniflare bindings (`run()` returns canned stream/JSON) — NO real AI in tests. Unit: prompts (action coverage, language interpolation), router fallback logic, daily-window counting. Integration: guest flow 3 → 4th 403; user flow day-window; conversation ownership (user A cannot read B's); ledger row written with usage; SSE frame shape.                                                                 | Deterministic CI; no AI cost/flake in tests.                                                                                                                                     |

## 3. Request Flow (§33 conformance)

```text
POST /api/tutor/chat
  requestId → IP throttle → identityMiddleware
  → entitlements: guest (guest_usage.ai_tutor<3) | user (ai_usage today <10)
  → validate body → resolve/create conversation (ownership)
  → persist user message → build messages[] (system+context+user)
  → AI Router: AI.run(primary, {messages, stream:true})
      └─ on error → AI.run(fallback, …) once
  → 200 SSE: pass-through deltas; capture usage frame
  → waitUntil: persist assistant message, ai_usage row, guest decrement
```

## 4. Definition of Done (Step 5)

1. Migration 0003 applied local + remote ×3; AI binding deployed to all envs.
2. Chat endpoint streams on staging with the real primary model (manual smoke:
   one guest chat, quota decrements, ledger row written); deterministic test suite
   with mock AI stays green in CI.
3. Guest quota (3) enforced end-to-end; user daily window (10) enforced; 403
   machine code surfaced in UI copy (en/tr).
4. Tutor UI live on `/en/tutor` + `/tr/tutor` — actions, streaming display, states,
   localized; placeholder route replaced.
5. Docs: architecture.md AI section; ai_usage fields recorded per §14.
6. Gates green; comprehensive review dispatched; ledger closed with dispositions.

---

## Amendment A (2026-09-12, post-review closure)

- **D4/D8 superseded**: v1 ships NON-STREAMING chat. Two workerd stream-deadlock
  findings during testing (unhandled TransformStream cancellations stalling the
  runtime) made SSE pass-through the riskiest component; non-streaming also
  strengthens §13.6 (exact synchronous token accounting, no estimation path).
  SSE streaming is deferred to a 5b enhancement. (JSON) replaces
  the SSE frame contract.
- **D9 additions shipped**: (used/limit per identity) backs
  the UI quota hint; the latest conversation resumes on page load.
- **§3 order note**: body validation runs before the entitlement gate (cheaper:
  garbage requests skip D1 reads); the quota is still enforced strictly pre-AI.
- **Accepted (reviewed)**: small check-then-act quota races under burst
  (documented; strict budget hardening lands with the AI-budget step); throttle
  pepper falls back to a constant when GUEST_SESSION_SECRET is unset
  (authenticated-user path only, KV keys are not attacker-readable).
