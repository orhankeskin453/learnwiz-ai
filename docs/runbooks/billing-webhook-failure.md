# Runbook: Polar Webhook Failure

Status: skeleton — expand when Polar billing lands (Step 11 per CLAUDE.md §48).
Source procedure: CLAUDE.md §43 "Polar Webhook Failure".

## Detect

Webhook endpoint errors / subscription state drift (logs filtered by route `/webhooks/polar`).

## Initial response

1. Inspect signature verification results and idempotency-key table for the event id.
2. Retry the webhook safely (idempotent handler required before any replay).
3. Verify D1 subscription + entitlement state matches the provider.
4. Audit-log the intervention (§41.12).
