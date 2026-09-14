# Architecture (Step 1 baseline)

Target end-state architecture is defined in CLAUDE.md §12/§38. This document
describes what is ACTUALLY deployed today and grows with each step.

## Topology

```text
Browser ──► Cloudflare edge ──► Worker "learnwizai-api" (single worker, same-origin)
                                  ├── /api/*  → Hono app (run_worker_first)
                                  └── /*      → Workers Static Assets (SPA, not_found → index.html)
Bindings: DB (D1) · CACHE (KV) · DOCS (R2) · ASSETS
```

Same-origin keeps HttpOnly session cookies (CLAUDE.md §47.9) free of CORS/CSRF
split-brain. The topology can be split into two workers later without monorepo
changes (spec §5).

## Environments & resources

| Env        | Worker                 | D1 (weur)            | KV                   | R2                     |
| ---------- | ---------------------- | -------------------- | -------------------- | ---------------------- |
| dev        | learnwizai-api-dev     | learwizai-db-dev     | learwizai-kv-dev     | learwizai-docs-dev     |
| staging    | learnwizai-api-staging | learwizai-db-staging | learwizai-kv-staging | learwizai-docs-staging |
| production | learnwizai-api         | learwizai-db-prod    | learwizai-kv-prod    | learwizai-docs-prod    |

Resource IDs live in `workers/api/wrangler.jsonc` (committed source of truth).
The existing D1/KV/R2/Vectorize/Queue resource names retain the historical
`learwizai-*` identifier for data continuity; the public Worker names and URLs
use the corrected `learnwizai-*` spelling.
URLs: `https://<worker>.orhankeskinn1.workers.dev`.

## Monorepo

pnpm workspaces; internal packages export TypeScript source (bundlers compile).
`packages/validation` schemas are compile-time-locked to `packages/types` via a
bidirectional `LocaleLock` forcing function — cross-layer contract drift fails
`pnpm typecheck` (CLAUDE.md §40.6).

## Frontend architecture (Step 2)

```text
main.tsx → ThemeProvider → RouterProvider (createBrowserRouter, routes.tsx)
  /            → LocaleRedirect (resolveLocale → /{locale})
  /:locale     → LocaleGate (localeSchema validation, i18n + <html lang> + hreflang sync)
      ├─ AppShell (sidebar / bottom nav / toaster) → placeholder pages (EmptyState)
      └─ style-guide → StyleGuidePage (design-system showcase)
  *            → localized 404
```

Styling: Tailwind v4 + CSS-variable tokens (§8 palette, dark-mode-ready); components
vendored from shadcn/ui (Radix). i18n: react-i18next, en/tr JSON namespaces, typed keys,
CI-enforced parity. Details: `docs/design-system.md`, `docs/localization.md`.

## Backend: identity, guest sessions, entitlements (Step 3)

```text
request → requestId (X-Request-Id) → guestCreateThrottle (POST only, KV 20/h/IP)
        → identityMiddleware (guest cookie → HMAC verify → D1 row)
        → handler
```

- **Identity** (`workers/api/src/middleware/identity.ts`): every `/api` request is
  classified `guest | anonymous` (authenticated joins at Step 4). The guest cookie
  `learwiz_guest_session` carries `<256-bit id>.<HMAC-SHA256 signature>` — HttpOnly,
  SameSite=Lax, 7-day Max-Age, `Secure` on staging/production. Secret:
  `GUEST_SESSION_SECRET` Workers secret (fail-closed 500 `config_error` when unset).
- **Guest lifecycle** (`POST`/`GET /api/guest/session`): idempotent create, machine
  error codes (`guest_session_not_found` 404, `guest_session_invalid` 401,
  `rate_limited` 429 + `Retry-After`). State lives in D1 `guest_sessions` +
  per-feature `guest_usage` counters (migration 0001); expired/migrated sessions are
  recoverable by creating a fresh one.
- **Entitlements** (`services/entitlements.ts`): server-authoritative guest matrix
  (§5.1: AI Tutor 3, Learn Mode 1, Practice 3, Quiz 1). Plans with period resets land
  with billing; the service is the single gate feature routes call (§17).
- **Throttle** (`middleware/guestThrottle.ts` + `services/rateLimit.ts`): KV
  fixed-window counter keyed by peppered IP hash — fail-open, raw IPs never stored.
  Strict AI budget controls arrive with the AI step.

## Backend: authentication + transactional email (Step 4)

```text
POST /api/auth/register      → pending user + verification email (generic 201)
POST /api/auth/verify-email  → activate + session cookie + guest migration + welcome
POST /api/auth/login         → active accounts only; generic 401 on any failure
POST /api/auth/logout        → server-side session revocation (204)
GET  /api/auth/me            → profile from the resolved identity
POST /api/auth/request-password-reset → generic 200 (anti-enumeration)
POST /api/auth/reset-password → rehash + revoke ALL sessions
POST /api/auth/resend-verification → generic 200, 3/h/email
```

- **Sessions** (`services/sessions.ts`): `learwiz_session` HttpOnly cookie carries a
  256-bit token; D1 stores only its SHA-256 hash. 30-day expiry, per-session and
  revoke-all support (password resets). Identity middleware precedence:
  active user session > guest session > anonymous; suspended accounts fall back to
  anonymous even with a valid session (§40.8).
- **Passwords** (`services/passwords.ts`): PBKDF2-HMAC-SHA256 (WebCrypto), 100k
  iterations (env-tunable, self-describing storage format).
- **Tokens** (`services/tokens.ts`): verification (24h) and password-reset (1h)
  tokens — 256-bit random, SHA-256 stored, single-use, purpose-typed; re-issue
  invalidates outstanding same-purpose tokens.
- **Email** (`src/email/`): provider abstraction + outbox. `LogEmailProvider`
  (default) records sends to `email_events` without network delivery;
  `CloudflareEmailProvider` is dormant until the operator verifies a sending domain
  (`EMAIL_PROVIDER=cloudflare` + runbook: docs/runbooks/email-delivery.md).
  Templates localized en/tr. Anti-enumeration: register/reset/login failure
  responses identical whether or not the email exists.
- **Audit** (`services/audit.ts` → `audit_events`): signup, verification, login
  success/failure, logout, password reset, guest migration. No credentials logged.

## Backend: AI Tutor, AI Router, usage accounting (Step 5)

```text
POST /api/tutor/chat                → guest 3 total / free 10-per-UTC-day (§10.10)
GET  /api/tutor/conversations       → owner-scoped list
GET  /api/tutor/conversations/:id   → owner-scoped detail with messages
GET  /api/tutor/quota               → used/limit for the resolved identity
```

- **AI Router** (`services/ai/router.ts`): primary `@cf/zai-org/glm-4.7-flash` with
  exactly ONE env-tunable fallback attempt (`AI_FALLBACK_MODEL`, §18); model
  failures logged (§20); both OpenAI-compatible and legacy response shapes parsed.
- **Prompts** (`services/ai/prompts.ts`): persona + six §10.3 learning actions;
  response language forced by request locale (§6.4); user content is untrusted
  material, never instructions (§19).
- **Usage ledger** (`ai_usage`, §14): exact tokens + actual `neurons` per call,
  plan, locale, `routed_fallback`, `usage_estimated`, latency. Free-plan daily
  window counts ledger rows per UTC day. v1 is non-streaming (exact synchronous
  accounting); SSE streaming is a deferred 5b enhancement.
- **Persistence**: `conversations` + `messages` with single-owner CHECK and
  owner-scoped reads (§40.7). Tutor UI at `/{locale}/tutor`: action chips,
  conversation resume, quota hint, localized errors (model names never shown, §29).

## Planned additions (not yet deployed)

- Vectorize index + Queues producer/consumer (Step 6 — RAG)
- Email Service, Polar billing, Analytics Engine (later steps)

Design decisions and rationale: `docs/superpowers/specs/2026-09-11-step1-foundation-design.md`.
