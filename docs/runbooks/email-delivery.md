# Runbook: Transactional Email Delivery (Cloudflare Email Service)

Status: **DORMANT** — the application ships with `LogEmailProvider` (default), which
records every send in the `email_events` outbox without network delivery. Real
delivery is a deliberate operator switch, gated on the steps below.

## Why dormant

workers.dev subdomains cannot send authenticated transactional email. LearnWiz AI
needs a verified sending domain with SPF/DKIM/DMARC before
`CloudflareEmailProvider` can deliver (CLAUDE.md §47.12, §40.15).

## Activation checklist

1. **Domain**: add the sending domain (e.g. `learwizai.com`) to the Cloudflare
   account that hosts the Workers.
2. **Email Service**: enable Cloudflare Email Service for the domain and complete
   the domain verification flow (DNS records).
3. **DNS authentication**: publish the provider-recommended SPF, DKIM and DMARC
   records. Verify with `dig`/MXToolbox before proceeding.
4. **Sender addresses**: create/configure the sender identities (recommended:
   `noreply@`, `support@`, `billing@` — §47.12). Set `EMAIL_FROM_ADDRESS`
   (Workers var) to the default sender.
5. **Wire the provider**: add the Cloudflare Email Service binding to
   `workers/api/wrangler.jsonc` (all environments), extend `Env` in
   `workers/api/src/env.ts`, and implement `CloudflareEmailProvider.send()`
   (`src/email/providers/cloudflare.ts` — currently a documented stub).
6. **Switch**: set the `EMAIL_PROVIDER` var to `cloudflare` per environment
   (`wrangler deploy` picks up vars; staging first).
7. **Verify**:
   - staging: register a test account → `email_events.status = 'sent'` with a
     provider message id → inbox receives the verification mail (check spam too).
   - production: same via a real signup.
8. **Rollback**: set `EMAIL_PROVIDER=log` and redeploy — outbox keeps recording,
   no emails go out.

## Failure triage

- `email_events.status = 'failed'` → inspect `last_error`; common causes: DNS not
  propagated (SPF/DKIM), unverified destination for the trial flow, rate limits on
  the provider.
- Reset/verification emails not arriving but `sent`: check DMARC reports and the
  recipient's spam folder; confirm the template link origin (`APP_ORIGIN`)
  matches the deployed SPA.
- Outbox retry: re-queue by inserting a new attempt — never reuse consumed tokens
  (`auth_tokens` are single-use; use the resend endpoints instead).
