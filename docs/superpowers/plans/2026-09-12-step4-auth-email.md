# LearWizAI — Step 4 Plan: Authentication & Email Foundation

Spec (binding): docs/superpowers/specs/2026-09-12-step4-auth-email-design.md
Execution: controller-implemented, single comprehensive review at step close
(same mode as Steps 2 Tasks 7–10 and Step 3 — disclosed, not re-asked).
Ledger: .superpowers/sdd/2026-09-12-step4-auth-email/progress.md.

## Tasks

- **T1 — Migration 0002_auth_email.sql**: `auth_tokens` (purpose-typed, hashed,
  single-use), `email_events` (outbox), `audit_events`. Additive; local test apply +
  remote apply at deploy.
- **T2 — Contracts**: types (`UserProfile`, auth request/response shapes, new
  ApiErrorCode values: invalid_credentials, email_not_verified, account_suspended,
  validation_error, unauthenticated); validation schemas `registerSchema`,
  `loginSchema`, `resetRequestSchema`, `resetConfirmSchema`, `verifyEmailSchema`
  (password policy: min 10, max 128, §40.10).
- **T3 — Core services**: `passwords.ts` (PBKDF2 D1: hash/verify, iteration env);
  `tokens.ts` (random token + SHA-256 hash helpers, auth-token create/consume);
  `audit.ts` (write audit_events).
- **T4 — Email**: `email/provider.ts` (EmailProvider interface + selection),
  `email/providers/log.ts`, `email/providers/cloudflare.ts` (dormant),
  `email/templates/{en,tr}/{verification,welcome,password-reset}.ts` + shell,
  `email/outbox.ts` (queue + mark sent/failed).
- **T5 — Routes & identity**: identity middleware user resolution (D11);
  `routes/auth.ts` (register, verify-email, resend-verification, login, logout,
  request-password-reset, reset-password, me); guest migration hook (D10); rate
  limits via generalized KV helper (D8); env.ts additions (D12).
- **T6 — Tests**: unit (passwords, tokens, templates, rate limit helper);
  integration per spec §4 matrix. Gates: typecheck/lint/test/build/format.
- **T7 — Closure**: docs (architecture.md auth section, runbooks/email-delivery.md),
  remote migrations, deploy staging + production, smoke (dev outbox verification
  path + prod health), comprehensive review agent → fixes → ledger closure.

## Global constraints

- No new runtime dependencies (WebCrypto PBKDF2; no argon2/wasm).
- No raw tokens/passwords in logs or audit; hashed only in D1.
- Localized templates en+tr same commit; template selection unit-tested.
- Auth UI explicitly deferred to Step 4b (ledger-tracked DoD follow-up).
