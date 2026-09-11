# Runbook: Database Incident

Status: skeleton — kept current as migrations accumulate.
Source procedure: CLAUDE.md §43 "Database Incident".

## Detect

Elevated D1 errors/latency in worker logs; failed migration apply.

## Initial response

1. STOP destructive changes and pending migrations.
2. Inspect the most recent migration + application version deployed.
3. Roll back the application if the incident correlates with a deploy (see deployment.md).
4. Recover data per §39.8 — never assume migrations auto-reverse.
