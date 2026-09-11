# Runbook: Queue Backlog

Status: skeleton — expand when Queues land with document processing (Step 6).
Source procedure: CLAUDE.md §43 "Queue Backlog".

## Detect

Document processing latency rising; consumer errors in Workers logs.

## Initial response

1. Identify the bottleneck stage (parse/chunk/embed/index).
2. Inspect failed/dead-lettered messages.
3. Verify consumer worker + Workers AI capacity.
4. Retry dead-lettered work safely (idempotent processing).
5. Monitor drain rate until backlog clears.
