# LearWizAI — Step 3 Plan: Guest Session & Identity Foundations

Spec (binding): docs/superpowers/specs/2026-09-12-step3-guest-identity-design.md
Execution: controller-implemented (as in Step 2 Tasks 7–10), single comprehensive
review dispatched at step close. Ledger: .superpowers/sdd/2026-09-12-step3-guest-identity/.

## Tasks

### Task 1 — Migration 0001 + test D1 wiring

- Create `db/migrations/0001_guest_identity.sql` (spec §4: users, sessions,
  guest_sessions, guest_usage — additive, CHECK constraints, indexes).
- `workers/api/vitest.config.ts`: async config via `readD1Migrations`, inject
  `TEST_MIGRATIONS` binding, `setupFiles: ["./test/apply-migrations.ts"]`.
- Create `workers/api/test/apply-migrations.ts` (+ ProvidedEnv augmentation d.ts).
- Gates: worker `pnpm test` green (health suite still passes on migrated DB).

### Task 2 — Shared contracts

- `packages/types`: `Feature`, `FeatureUsage`, `GuestSessionResponse`, `ApiError`
  machine codes union; export all.
- `packages/validation`: `featureSchema` + bidirectional `FeatureLock` (mirror the
  LocaleLock pattern) + test.
- Gates: root typecheck + validation tests.

### Task 3 — Session crypto + entitlements services

- `workers/api/src/services/sessionCrypto.ts`: `generateGuestSessionId()` (32B hex),
  `signGuestCookie(id, secret)`, `verifyGuestCookie(value, secret)` → id | null
  (HMAC-SHA256 WebCrypto, constant-time compare).
- `workers/api/src/services/entitlements.ts`: §5.1 matrix (ai_tutor 3, learn_mode 1,
  practice 3, quiz 1) as static config; `getEntitlements`, `checkBudget` (allow |
  exceeded), `recordUsage` (D1 upsert). Identity input shaped for future
  authenticated plans.
- Unit tests: roundtrip/tamper/short-secret; exact matrix numbers; budget outcomes.
- Env: `GUEST_SESSION_SECRET` added to `Env` interface; `.dev.vars.example` + set
  secrets in dev/staging/production (operator step, documented).

### Task 4 — Identity middleware + guest routes + KV throttle

- `workers/api/src/middleware/identity.ts`: Hono middleware, typed Variables
  (`identity: Identity`), guest resolution (verify → D1 lookup → expiry +
  migration_status checks → fail-closed 401/404 semantics as spec §5), anonymous
  fallback. `users/sessions` resolution stub lands in Step 4.
- `workers/api/src/services/rateLimit.ts`: KV window counter
  (`rl:guest-create:{ipHash}`; sha256(ip + secret); 20/h; fail-open).
- `workers/api/src/routes/guest.ts`: `POST /` (throttle → idempotent create →
  201/200 + Set-Cookie) and `GET /` (status + remaining budgets). Mount at
  `/api/guest/session` in `index.ts`.
- Integration tests (spec §6): full matrix incl. cookie attributes, idempotency,
  tamper 401, expiry 401, rate limit 429, envelope errors.

### Task 5 — SPA api client foundation

- `apps/web/src/services/apiClient.ts`: same-origin typed fetch wrapper
  (JSON envelope, ApiError machine codes, no credentials fiddling — same-origin
  cookies flow by default).
- `apps/web/src/services/guestSessions.ts`: `createGuestSession()`,
  `getGuestSession()` typed against `GuestSessionResponse`.
- Tests: mocked-fetch contract tests (path, method, envelope parse, error mapping).

### Task 6 — Docs + deploy + step closure

- `docs/architecture.md`: backend section (identity middleware, guest session
  lifecycle, entitlements, rate limiting posture).
- Deploy: push → staging auto; production dispatch; `wrangler d1 migrations apply`
  for dev/staging/production (remote); set `GUEST_SESSION_SECRET` per env first.
- Smoke: /api/health ×3 envs; POST /api/guest/session on staging (cookie attrs) via
  --resolve method.
- Comprehensive review (one dispatched agent over the whole step diff) → fixes →
  ledger closure.

## Global constraints

- No new runtime dependencies (zod, hono already present; WebCrypto is built-in).
- No secrets in source; `.dev.vars` is gitignored; `.dev.vars.example` documents shape.
- TypeScript strict; shared types reused; no `any`.
- All user-facing strings this step are API machine codes + docs (no UI text).
- Never store raw IPs (peppered hash only).
