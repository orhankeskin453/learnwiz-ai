# LearWizAI — Step 4b: Authentication UI Design Spec

Binding authority for Step 4b. Wires the Step 4 auth backend (already deployed) into
the SPA per CLAUDE.md §10.9 (auth flow), §31 (route map), §6.2 (`auth` namespace),
§36 (DoD), §37.3 (no hardcoded strings). Companion to Step 4's spec — read together.

## 1. Scope

IN:

- Five pages under `/{locale}/auth/*`: **register**, **verify-email** (email-link
  landing, auto-verifies), **login**, **forgot-password**, **reset-password** —
  rendered OUTSIDE the AppShell in a minimal centered `AuthLayout` (conversion
  funnel pages stay distraction-free).
- `auth` i18n namespace (en/tr, §6.2 list).
- Shell integration: **PlanCard becomes identity-aware** — fetches `GET /api/auth/me`;
  authenticated → email + logout button; guest → create-account CTA + login link
  (the conversion funnel: guest quota copy now has a clickable target).
- Client-side pre-validation (required fields, min length hints); server remains
  the authority (Step 4 schemas).

OUT (deferred, recorded): Google OAuth (operator credentials — Step 5), magic links
(§45 item 14), MFA, email-preference UI, "remember me", delete-account UI.

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                         | Rationale                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1  | Auth pages live OUTSIDE the AppShell (`/:locale/auth/*` siblings of the shell route) with a shared `AuthLayout`: brand header, centered card, back-to-app link.                                                                                                                                                                                                                                                                  | §10.9 simple flow; funnel focus; no sidebar distractions.                                     |
| D2  | Verification page AUTO-submits on mount (the email link IS the action — token single-use): states = verifying → success (session set by backend, "Continue to dashboard" button) → invalid/expired (error + link to login/resend).                                                                                                                                                                                               | §47.3 flow; one click from email to session.                                                  |
| D3  | Register success shows a "Check your email" screen (NO session — backend keeps accounts pending until verification, §40.3); includes a resend-verification action + email confirmation display.                                                                                                                                                                                                                                  | §40.9 generic responses; anti-enumeration shape means the screen is identical for duplicates. |
| D4  | Login states (§40.3/§47): 401 invalid_credentials → localized inline error; 403 email_not_verified → inline error + resend-verification action; 403 account_suspended → localized error; success → redirect to `/{locale}` (dashboard).                                                                                                                                                                                          | Spec Step 4 D5.                                                                               |
| D5  | Password reset: forgot form → generic success screen (anti-enumeration, §40.9); reset form reads `?token=`, posts new password → success → link to login. Token invalid → localized error.                                                                                                                                                                                                                                       | Step 4 D9/D4.                                                                                 |
| D6  | Client validation is a UX layer only: required fields, email format (input type), password min 10 with visible hint. The server (`@learwizai/validation` schemas) remains authoritative; server `validation_error` renders the localized generic message.                                                                                                                                                                        | §40.10; §23 server authority.                                                                 |
| D7  | Identity in the shell: PlanCard (sidebar) and MoreSheet? — PlanCard only in this step: on mount `GET /api/auth/me` → authenticated: show email (truncated), "Free" plan badge, logout button (POST logout → reset to guest state); guest: current Free badge + usageUnavailable copy + create-account/login links. Auth state lives in a tiny `AuthProvider` (context) so logout/verify updates propagate without prop drilling. | §9 sidebar plan/usage slot; §29 conversion funnel; minimal state.                             |
| D8  | After logout or login, the SPA does a full state refresh via `window.location` reload to the target route — avoids stale per-page AI quota state. Redirects use the CURRENT locale.                                                                                                                                                                                                                                              | Simplicity; quota hints are per-identity.                                                     |
| D9  | Tests: page-level flows with URL-dispatch fetch mocks — register→check-email screen (+ resend call), verify auto-submit success/invalid, login success redirect + email_not_verified state, forgot/reset flows, PlanCard authenticated vs guest rendering + logout, auth routes render outside the shell.                                                                                                                        | Deterministic CI.                                                                             |

## 3. Definition of Done (Step 4b)

1. Five pages live at `/{en,tr}/auth/*`; route map matches §31.
2. Full loop verified on staging with a REAL email address via the log-provider
   outbox (register → outbox token → verify → me) — same evidence pattern as
   Step 4's smoke, now through the UI's own API calls.
3. PlanCard identity-aware (authenticated + guest states), logout works.
4. `auth` namespace complete in en+tr; parity test green.
5. Gates green; comprehensive review dispatched; ledger closed with dispositions.
