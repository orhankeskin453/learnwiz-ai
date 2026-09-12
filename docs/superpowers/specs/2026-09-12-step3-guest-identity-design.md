# LearWizAI — Step 3: Guest Session & Identity Foundations Design Spec

Binding authority for Step 3. Implements CLAUDE.md §5 (Guest Session Architecture),
§5.1 (guest entitlements), §17 (entitlement architecture), §18 (rate limiting), §22
(route grouping / middleware order), §33 (guest request flow), §34 (service interfaces),
§45/§48 item 5 ("Guest session + identity foundations"). Admin Dashboard is POSTPONED
per the 2026-09-12 product decision recorded in CLAUDE.md §41 — nothing here builds it.

## 1. Goals

1. A server-authoritative guest session: `learwiz_guest_session` cookie + D1 record,
   created lazily via `POST /api/guest/session`, inspectable via `GET /api/guest/session`.
2. Identity resolution middleware that classifies every `/api` request as
   `guest | anonymous` today, with `authenticated` plugging in at Step 4 (auth) without
   structural change.
3. A centralized EntitlementService (§17/§34 shape) with the §5.1 guest limits as
   **server-side configuration** — no frontend authority over limits.
4. D1 schema for the §16 identity core: `users`, `sessions`, `guest_sessions`,
   `guest_usage` (migration 0001, additive, all three environments).
5. Per-IP rate limiting on guest session creation (§18) using the KV CACHE binding.
6. Shared typed contracts (`@learwizai/types` + `@learwizai/validation`) and a typed
   same-origin API client foundation for the SPA.

## 2. Out of Scope (deferred by step order)

- Signup / login / verification / OAuth / email (§48 item 6) — the `users` and
  `sessions` tables are created now but nothing writes/reads them yet.
- AI Tutor, Learn Mode, Practice, Quiz features that _consume_ the entitlements
  (§48 items 7–8).
- Guest → account migration logic (§5.2 — lands with auth); `migration_status`
  column exists now.
- Free/Learner/Pro plan entitlements with period resets (§10.10) — land with billing;
  only the guest matrix is implemented here.
- Strict AI budget controls / Turnstile (§18 hardening step); the KV throttle here is
  the coarse first line.
- Admin Dashboard — POSTPONED (2026-09-12 decision, CLAUDE.md §41).

## 3. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                        | Rationale                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Guest session = opaque 256-bit random id (hex) in an **HMAC-signed cookie** (`<id>.<sig>`, HMAC-SHA256 over the id, WebCrypto) + D1 row.                                                                                                                                                                                                        | §5 "signed/secure session cookie"; tampered/forged ids fail closed before D1; HttpOnly keeps it out of JS.                       |
| D2  | Cookie: `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800; Secure` — `Secure` on staging/production only (workers.dev is HTTPS-only; `wrangler dev` serves plain HTTP locally).                                                                                                                                                                   | §5 attributes; must survive local development.                                                                                   |
| D3  | Fixed 7-day expiry from creation (`expires_at`), no sliding renewal in this step.                                                                                                                                                                                                                                                               | "Reasonable expiration" (§5); conversion pressure by design; cheap to reason about.                                              |
| D4  | Secret from `GUEST_SESSION_SECRET` Workers secret (all 3 envs + `.dev.vars` for local + injected test binding). Missing/short secret ⇒ identity middleware fails closed (500 on guest routes).                                                                                                                                                  | §19 secrets in Workers secrets, never in frontend/client source.                                                                 |
| D5  | Usage model: `guest_usage (guest_session_id, feature, used)` upsert rows per §5.1 capability — NOT a single `usage_count`.                                                                                                                                                                                                                      | §5.1 defines per-capability limits; single counter cannot express them.                                                          |
| D6  | EntitlementService = pure functions + static guest config in the worker (`services/entitlements.ts`): `getEntitlements(identity)`, `checkBudget(identity, feature)`, `recordUsage(identity, feature)`. Plans table (§16) arrives with billing; the interface is plan-ready (§34).                                                               | §17 centralization, §11.2 product-usage vs billable-usage separation; "configuration data, not frontend hardcoded rules" (§5.1). |
| D7  | Rate limiting guest creation: KV window counter keyed by `sha256(ip + secret pepper)`, 20 creates/hour/IP, fail-open on KV errors (abuse throttle, not a correctness control).                                                                                                                                                                  | §18 IP limits; §12.1 "non-critical counters" clause; no raw IP stored (privacy).                                                 |
| D8  | No request bodies in this step ⇒ no new zod request schemas; `@learwizai/validation` gains `featureSchema` with a bidirectional lock to `@learwizai/types` `Feature` (same pattern as `localeSchema`).                                                                                                                                          | §40.6-style contract locking established in Step 1.                                                                              |
| D9  | Response contract: success bodies typed in `@learwizai/types`; errors use the Step 1 envelope `{ error: <machine_code>, message? }`. Guest routes: `401 {error:"guest_session_invalid"}` (bad/expired/tampered cookie), `404 {error:"guest_session_not_found"}` (no cookie on GET), `429 {error:"rate_limited"}`, `500 {error:"config_error"}`. | Extends the existing `not_found` envelope; machine codes for the typed client.                                                   |
| D10 | Frontend: `apps/web/src/services/apiClient.ts` + `guestSessions.ts` (typed, same-origin, credentials included by default). No visible UI change — placeholder pages stay until the Tutor step.                                                                                                                                                  | Identity foundations are backend + contracts; features build on the client.                                                      |

## 4. D1 Schema (migration `0001_guest_identity.sql`, additive)

```sql
users            (id TEXT PK, email TEXT, email_normalized TEXT UNIQUE NOT NULL,
                  password_hash TEXT, email_verified_at TEXT,
                  status TEXT CHECK in ('pending','active','suspended','deleted') DEFAULT 'pending',
                  locale TEXT CHECK in ('en','tr') DEFAULT 'en',
                  role TEXT CHECK in ('user','admin') DEFAULT 'user',
                  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT)
sessions         (id TEXT PK, user_id TEXT NOT NULL FK->users ON DELETE CASCADE,
                  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
                  last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT)
                 + idx (user_id), idx (expires_at)
guest_sessions   (id TEXT PK, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
                  migration_status TEXT CHECK in ('pending','migrated','expired') DEFAULT 'pending',
                  ip_hash TEXT) + idx (expires_at)
guest_usage      (guest_session_id TEXT FK->guest_sessions ON DELETE CASCADE,
                  feature TEXT CHECK in ('ai_tutor','learn_mode','practice','quiz'),
                  used INTEGER NOT NULL DEFAULT 0, last_used_at TEXT,
                  PRIMARY KEY (guest_session_id, feature))
```

Timestamps are ISO-8601 TEXT (UTC). No user data is stored in guests beyond usage
counters (§5: "Do not migrate temporary/unsafe data" applies at migration time).

## 5. Request Flows (§22/§33 conformance)

```text
POST /api/guest/session
  request id → IP throttle (KV) → resolve identity
    ├─ valid guest cookie → 200 existing status (idempotent, no new row)
    └─ none/invalid       → create D1 row + signed Set-Cookie → 201 status
GET  /api/guest/session
  resolve identity → 200 status | 404 (no cookie) | 401 (invalid/expired)
Future guest-feature route (contract, not built here):
  resolveIdentity → entitlements.checkBudget → handler → recordUsage → respond
```

Middleware order matches §22: context/request-id → security checks (throttle) →
identity resolution → (feature routes: entitlement + validation) → handler.

## 6. Testing (vitest-pool-workers + local D1)

- Migrations applied in tests via `readD1Migrations` + `applyD1Migrations` (official
  recipe; `TEST_MIGRATIONS` binding injected in `vitest.config.ts`).
- Unit: HMAC sign/verify roundtrip, tamper rejection, constant-time compare; guest
  entitlement matrix (§5.1 exact numbers); budget check outcomes (allow/exhaust).
- Integration (`SELF.fetch`): create → cookie attrs (HttpOnly/SameSite/Path/Max-Age,
  Secure off locally) → idempotent reuse (same session) → GET status remaining
  budgets → tampered cookie 401 → expired row 401 → rate limit 429 after threshold
  → unknown /api still 404 envelope.
- All worker tests run against the LOCAL miniflare D1 — never remote (README rule).

## 7. Risks & Mitigations

| Risk                                                   | Mitigation                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| KV counter race allows a few extra creates under burst | Accepted (abuse throttle, fail-open, §12.1); AI budget strictness comes with the AI step.                    |
| Secret misconfiguration in an env                      | Fail-closed 500 `config_error` on guest routes; health route unaffected; smoke catches it.                   |
| Cookie split-brain SPA↔worker                          | Same-origin deployment (Step 1); client never reads the guest cookie (HttpOnly) — status comes from the API. |
| `users`/`sessions` tables drift from auth step needs   | Additive migration discipline (§39.7); auth step amends with 0002+, never edits 0001.                        |

## 8. Definition of Done (Step 3)

1. Migration 0001 applied to local D1 in tests and to dev/staging/production D1
   (remote apply is an explicit operator step — `wrangler d1 migrations apply`).
2. `GUEST_SESSION_SECRET` set in all three environments (+ `.dev.vars` documented).
3. `POST`/`GET /api/guest/session` live on all environments; smoke shows guest flows.
4. EntitlementService unit-tested with the exact §5.1 matrix (3/1/3/1).
5. Typecheck/lint/tests/build/format green; integration suite covers cookie attrs,
   idempotency, tamper, expiry, rate limit.
6. Shared contracts exported; SPA api client foundation typed against them.
7. Docs: `docs/architecture.md` backend section grows (identity/guest/entitlements);
   README layout notes unchanged (no new packages).
8. Deployed to staging (auto) + production (dispatch); health + guest smoke green.
