# LearWizAI — Step 4: Authentication & Email Foundation Design Spec

Binding authority for Step 4. Implements CLAUDE.md §47 (auth/email/account lifecycle)
and §40 (identity/auth/authorization), delivery order per §45 (second list, items 1–8
of "Email and Auth Implementation Order") and §48 item 6. Admin protection (§45 item 13) is N/A — admin dashboard postponed (2026-09-12 decision).

## 1. Scope — this step vs 4b/5

IN (this step, backend + contracts + tests):

- Email + password: register, email verification (+resend), login, logout,
  password reset (request + confirm), `GET /auth/me`.
- Server-side sessions (`learwiz_session` HttpOnly cookie, hashed in D1).
- Auth tokens (verification/reset) — hashed, single-use, purpose-typed, short-lived.
- EmailProvider abstraction + outbox (`email_events`) + localized (en/tr) templates
  (verification, welcome, password reset) + LogEmailProvider; Cloudflare Email
  Service provider lands wired-but-dormant (operator domain step required).
- Identity middleware resolves `user` kind; suspended users rejected (§40.8).
- Guest-session migration hook (§5.2): status transition + audit; content migration
  becomes meaningful at the AI Tutor step (first guest-owned content).
- Audit events for the auth surface (§40.16). Rate limits on all auth endpoints (§47.14).

OUT (explicitly deferred): auth UI pages (→ Step 4b — routes/pages/i18n namespaces
`auth`), Google OAuth (§40.12 — needs operator OAuth client; → Step 5), magic links
(→ later per §45 item 14), MFA, email preference center (§47.10), marketing email.

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Password hashing: **PBKDF2-HMAC-SHA256 via WebCrypto**, 100 000 iterations (env-overridable `PASSWORD_HASH_ITERATIONS`), 16B salt, self-describing storage `pbkdf2$sha256$<iter>$<salt>$<hash>`.                                                                                                                                                                             | §40.10 "modern algorithm, never plain SHA-256"; Workers-native (no WASM dep). ⚠ CPU: ~100k iters needs Workers Paid headroom; free-plan CPU (10 ms) may abort — documented operator note, iteration count env-tunable. |
| D2  | Session token: 256-bit random hex in cookie, **only SHA-256(token) stored** (`sessions.token_hash` UNIQUE). 30-day fixed expiry, revoked_at + revoke-all support. Cookie `learwiz_session`: HttpOnly, SameSite=Lax, Path=/, Secure on staging/production, Max-Age 2592000.                                                                                                   | §40.4/§47.9 — server-authoritative sessions, no raw tokens in D1.                                                                                                                                                      |
| D3  | Auth tokens: single `auth_tokens` table, `purpose` CHECK ('email_verification' 24 h, 'password_reset' 1 h), 256-bit random token, SHA-256 stored, `consumed_at` single-use, indexed.                                                                                                                                                                                         | §40.9 (typed, hashed, single-use, short-lived); one table satisfies "explicit purpose" without duplication.                                                                                                            |
| D4  | Anti-enumeration: login always `401 invalid_credentials`; password-reset request always generic 200; register-with-existing-email returns the same 201-shaped generic body WITHOUT creating anything or emailing.                                                                                                                                                            | §47.1/§40.9.                                                                                                                                                                                                           |
| D5  | Verification gate: login allowed for `pending` accounts ONLY with a 403 `email_not_verified` response (re-send path surfaced); `suspended` rejected with 403 `account_suspended` even with valid sessions (middleware, §40.8). `active` required for protected operations.                                                                                                   | §40.1/§40.8 identity states.                                                                                                                                                                                           |
| D6  | Email: `EmailProvider` interface (`send(message) → {providerMessageId?}`); `LogEmailProvider` (default; persists to outbox, logs to Workers Logs) and `CloudflareEmailProvider` (dormant until operator verifies sending domain; selected via `EMAIL_PROVIDER=cloudflare`). Outbox = `email_events` rows written BEFORE send attempt (§47.13), status machine `queued → sent | failed`.                                                                                                                                                                                                               | §47.4 abstraction + §47.13 outbox pattern; no deploy blocker from missing domain. |
| D7  | Templates: TypeScript modules per locale (`en.ts`/`tr.ts`) for verification, welcome, password-reset — subject + html + text, shared minimal HTML shell. Locale = user.locale. Links point at SPA routes (`/{locale}/auth/verify?token=…` — pages land in 4b; tokens still single-use server-side).                                                                          | §47.11/§40.14 localization-first.                                                                                                                                                                                      |
| D8  | Rate limits (KV fixed-window, generalized helper): register 5/h/IP, login 10/h/IP+email, verification-resend 3/h/email, reset-request 3/h/email. Fail-closed for these (429) EXCEPT KV outage → fail-open (abuse throttle posture, same as Step 3).                                                                                                                          | §47.14.                                                                                                                                                                                                                |
| D9  | Audit: `audit_events(id, actor_user_id?, action, resource_type?, resource_id?, request_id, metadata JSON, created_at)`; actions: signup_started/completed, email_verification_sent, email_verified, login_success/failed, logout, password_reset_requested/completed, session_revoked. Auth failure logs carry ids/emails-hashed, never passwords/tokens (§47.15).           | §40.16/§47.15.                                                                                                                                                                                                         |
| D10 | Guest migration hook: on verification (account activation) — if a valid guest session cookie accompanies signup/verify, `guest_sessions.migration_status → 'migrated'` + audit `guest_migration_completed`. Content migration (conversations, usage credit) lands with the AI Tutor step where guest content first exists.                                                   | §5.2 (idempotent, safe); §48 item 9 keeps full migration with authed dashboard.                                                                                                                                        |
| D11 | Identity middleware: user resolution = cookie → SHA-256 → `sessions ⋈ users` → checks (expires/revoked/status) → `identity { kind:"user", userId, sessionId }`; precedence over guest; invalid session cookie ⇒ anonymous (no error). `GET /auth/me` returns profile from identity.                                                                                          | §40.2 `authenticateRequest` shape.                                                                                                                                                                                     |
| D12 | Env additions: `EMAIL_PROVIDER` ("log" default), `EMAIL_FROM_ADDRESS` (config, not hardcoded §40.15), `APP_ORIGIN` (email link base), `PASSWORD_HASH_ITERATIONS`. No new secret this step.                                                                                                                                                                                   | §47.12 sender identity as configuration.                                                                                                                                                                               |

## 3. Request Flows (§47.3/§47.7 conformance)

```text
POST /api/auth/register {email, password}            [rate-limited]
  validate → existing email? → generic 201, NO side effects (anti-enum)
  → user(pending) + verification token + outbox email + audit signup_* → 201 generic
POST /api/auth/verify-email {token}                  [rate-limited]
  token valid+unconsumed+unexpired → mark verified, activate, consume token,
  create session (Set-Cookie), migrate guest (D10), welcome email queued → 200 me
POST /api/auth/login {email, password}               [rate-limited]
  verify → pending → 403 email_not_verified | suspended → 403 account_suspended
  | ok → session + audit login_success → 200 me
POST /api/auth/logout  → revoke current session → 204
GET  /api/auth/me      → 200 profile | 401 unauthenticated
POST /api/auth/request-password-reset {email} → always 200 generic
POST /api/auth/reset-password {token, password} → consume token, rehash, revoke ALL
  sessions, audit → 200
```

## 4. Testing (§47.16 subset for this scope)

- Unit: password hash/verify roundtrip + wrong-password + iteration-override;
  token lifecycle (expiry/consumption/purpose mismatch); email template selection
  (locale fallback); rate-limit helper.
- Integration (SELF.fetch + local D1): register→verify→me happy path; duplicate-email
  generic response (no outbox row); login pending → 403 email_not_verified; login
  bad password → 401 (same body for unknown email); suspended rejection; reset flow
  end-to-end incl. revoke-all (old session cookie invalid afterwards); logout revokes;
  cookie attributes; outbox rows with localized subjects (en/tr); audit rows written;
  rate limit 429s.
- All email sending in tests = LogEmailProvider (no network).

## 5. Risks & Mitigations

| Risk                                                           | Mitigation                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PBKDF2 CPU cost on free plan                                   | env-tunable iterations; operator note + deployment doc; hashing off hot paths only (register/login/reset).                          |
| Real email deliverability unverified (workers.dev cannot send) | LogEmailProvider default; CloudflareEmailProvider dormant behind EMAIL_PROVIDER + operator runbook (domain, SPF/DKIM/DMARC §47.12). |
| Token leakage via logs/referer                                 | tokens only in email links (SPA route) + request bodies; never logged; audit stores ids only.                                       |
| Session fixation                                               | new token generated at login/verification; old guest session left untouched.                                                        |

## 6. Definition of Done (Step 4)

1. Migration 0002 applied (local tests + remote dev/staging/prod).
2. All §3 endpoints live with validation, rate limits, audit, outbox; anti-enumeration
   behaviors verified by tests.
3. Identity middleware resolves user kind; suspended rejected; me endpoint works.
4. Localized email templates (en/tr) + outbox recorded; LogEmailProvider default.
5. Docs: architecture.md auth section + `docs/runbooks/email-delivery.md` (operator:
   domain, SPF/DKIM/DMARC, EMAIL_PROVIDER switch).
6. Gates green (typecheck/lint/test/build/format); §4 test matrix passes.
7. Deployed staging + production; smoke: register→verify (via outbox inspection on
   dev)→me; production health green.
8. Auth UI (4b) explicitly tracked as the follow-up deliverable in the ledger.
