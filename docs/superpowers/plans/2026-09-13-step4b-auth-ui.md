# LearWizAI — Step 4b Plan: Authentication UI

Spec (binding): docs/superpowers/specs/2026-09-13-step4b-auth-ui-design.md
Execution: controller-implemented, single comprehensive review at step close.
Ledger: .superpowers/sdd/2026-09-13-step4b-auth-ui/progress.md.

## Tasks

- **T1**: `auth` namespace (en/tr) + resources registration; `services/auth.ts`
  (register/login/logout/me/verify/resend/reset wrappers); `AuthProvider` context;
  `AuthLayout`; routes `/:locale/auth/*` outside the shell.
- **T2**: RegisterPage (+check-email state), VerifyEmailPage (auto-submit),
  LoginPage (verified/suspended states + resend), ForgotPasswordPage,
  ResetPasswordPage.
- **T3**: PlanCard identity-aware (me → email+logout | guest CTA), common.json
  additions (en/tr).
- **T4**: tests (page flows, PlanCard states) + gates + commit + deploy.
- **T5**: real-outbox smoke on staging (register → token → verify → me through
  API), comprehensive review → fixes → ledger closure.

## Global constraints

All copy via `auth` namespace (en+tr same commit); no new runtime deps; server
remains the validation authority (D6); redirects preserve the active locale (D8).
