# Runbook: AI Model Failure

Status: skeleton — expand when the AI Router lands (Step 6-7 per CLAUDE.md §48).
Source procedure: CLAUDE.md §43 "AI Model Failure".

## Detect

Elevated AI error rate / timeouts (Workers logs, observability MCP queries).

## Initial response

1. Identify the affected model from `ai_usage` / logs (model + task_type).
2. Verify provider status/capacity (Cloudflare Workers AI status).
3. Activate the approved fallback model (AI Router config) if the outage persists.
4. Do NOT retry-loop expensive requests — bounded retries only (§18).
5. Monitor recovery; record timeline in the incident notes.
