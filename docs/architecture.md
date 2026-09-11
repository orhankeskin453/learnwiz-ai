# Architecture (Step 1 baseline)

Target end-state architecture is defined in CLAUDE.md §12/§38. This document
describes what is ACTUALLY deployed today and grows with each step.

## Topology

```text
Browser ──► Cloudflare edge ──► Worker "learwizai-api" (single worker, same-origin)
                                  ├── /api/*  → Hono app (run_worker_first)
                                  └── /*      → Workers Static Assets (SPA, not_found → index.html)
Bindings: DB (D1) · CACHE (KV) · DOCS (R2) · ASSETS
```

Same-origin keeps HttpOnly session cookies (CLAUDE.md §47.9) free of CORS/CSRF
split-brain. The topology can be split into two workers later without monorepo
changes (spec §5).

## Environments & resources

| Env        | Worker                | D1 (weur)            | KV                   | R2                     |
| ---------- | --------------------- | -------------------- | -------------------- | ---------------------- |
| dev        | learwizai-api-dev     | learwizai-db-dev     | learwizai-kv-dev     | learwizai-docs-dev     |
| staging    | learwizai-api-staging | learwizai-db-staging | learwizai-kv-staging | learwizai-docs-staging |
| production | learwizai-api         | learwizai-db-prod    | learwizai-kv-prod    | learwizai-docs-prod    |

Resource IDs live in `workers/api/wrangler.jsonc` (committed source of truth).
URLs: `https://<worker>.orhankeskinn1.workers.dev`.

## Monorepo

pnpm workspaces; internal packages export TypeScript source (bundlers compile).
`packages/validation` schemas are compile-time-locked to `packages/types` via a
bidirectional `LocaleLock` forcing function — cross-layer contract drift fails
`pnpm typecheck` (CLAUDE.md §40.6).

## Planned additions (not yet deployed)

- Vectorize index + Queues producer/consumer (Step 6 — RAG)
- Workers AI binding + AI Router (Step 6-7 per §48)
- Email Service, Polar billing, Analytics Engine (later steps)

Design decisions and rationale: `docs/superpowers/specs/2026-09-11-step1-foundation-design.md`.
