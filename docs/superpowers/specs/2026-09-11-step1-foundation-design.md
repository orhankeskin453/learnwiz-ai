# LearWizAI — Step 1: Foundation Design Spec

- **Date:** 2026-09-11
- **Status:** Design approved in chat (Sections 1–6); awaiting spec review
- **Scope:** Step 1 — Foundation, per CLAUDE.md §35 and §45 (updated implementation priority, item 1–2)
- **Supersedes:** nothing (first spec)

---

## 1. Goals

Deliver the complete project foundation:

- pnpm monorepo: `apps/web`, `workers/api`, `packages/{types,validation,config}`
- TypeScript strict, end-to-end
- React + Vite + Tailwind web app (minimal placeholder status page only)
- Cloudflare Worker API (Hono) exposing `GET /api/health`
- Cloudflare resources provisioned for **dev / staging / production**: D1, KV, R2
- Private GitHub repository + GitHub Actions CI (typecheck → lint → test → build → migration validation → deploy)
- Docs skeleton per CLAUDE.md §44

Target audience note: the product is **global** (English default, Turkish supported from day one, per CLAUDE.md §6). Infrastructure decisions below reflect a global user base, not a TR-centric one.

## 2. Out of Scope (deferred by CLAUDE.md step order)

| Item | Lands in |
|---|---|
| Design system, UI primitives, i18n foundation | Step 2–3 |
| Guest sessions, identity foundations | Step 5 (§48) |
| Auth, email, sessions | Step 6 (§48) |
| D1 schema content (users, sessions, …) | Auth step — Step 1 provides the migration *harness* only (`db/migrations/` + apply scripts + CI validation) |
| Vectorize indexes, Queues | Step 6 (RAG) — rule 14: no premature infrastructure |
| Workers AI, AI Router, usage ledger | Step 7 (§48) |
| Polar billing | Step 11 (§48) |
| Custom domain | Production launch; `*.workers.dev` until then |
| Playwright / E2E | Testing-infrastructure item (§48 item 4); CI slot prepared now |

## 3. Decisions Summary

| Area | Decision |
|---|---|
| Package manager / workspace | pnpm 11 workspaces, no orchestrator (no Turborepo/Nx) |
| Worker router | Hono (lightweight, Workers-native; middleware chain per CLAUDE.md §22) |
| Validation | zod, schemas shared via `packages/validation` |
| Lint/format | ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks; Prettier |
| Unit/integration tests | Vitest; `@cloudflare/vitest-pool-workers` for Worker tests |
| Deploy topology | Single Worker serving `/api/*` + SPA static assets (same-origin) |
| Environments | One `wrangler.jsonc`: top-level = production, `env.staging`, `env.dev` |
| VCS / CI | GitHub private repo `learnwiz-ai`; GitHub Actions |
| Resource provisioning | Via Cloudflare MCP (bindings/API servers); IDs committed to `wrangler.jsonc` |
| D1 location hint | `weur` (balanced global hub; changeable later without data migration) |

## 4. Monorepo Layout

```
learwiz-ai/
├── apps/
│   └── web/                      # Vite + React + TS + Tailwind (SPA)
│       ├── src/
│       │   ├── components/       # UI primitives (filled in Step 2)
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── services/         # typed API client
│       │   ├── i18n/             # en/tr locales (Step 2)
│       │   └── main.tsx
│       ├── index.html
│       └── vite.config.ts
├── workers/
│   └── api/
│       ├── src/
│       │   ├── routes/           # /auth, /tutor, … (later steps)
│       │   ├── middleware/       # request-id, security, identity, entitlement, validation
│       │   ├── services/
│       │   ├── ai/
│       │   ├── rag/
│       │   ├── billing/
│       │   ├── auth/
│       │   ├── db/
│       │   └── index.ts          # fetch handler (Hono app)
│       ├── test/
│       └── wrangler.jsonc
├── packages/
│   ├── types/                    # shared domain types (frontend ↔ backend)
│   ├── validation/               # zod schemas — API request/response contracts (§40.6)
│   └── config/                   # shared tsconfig + eslint preset
├── db/
│   ├── migrations/               # versioned D1 SQL (first real migration with auth)
│   └── seed/
├── docs/                         # §44 skeleton: architecture.md, deployment.md, runbooks/
├── .github/workflows/ci.yml
├── .mcp.json                     # Cloudflare MCP servers (already present)
├── pnpm-workspace.yaml
├── tsconfig.base.json            # strict: true
├── eslint.config.js
├── .prettierrc / .gitignore
├── CLAUDE.md                     # already present
└── package.json                  # root scripts: typecheck, lint, test, build (pnpm -r)
```

Toolchain pins: Node 24 (installed v24.15.0), pnpm 11.24.0 via `packageManager` (corepack) + `engines`.

## 5. Deployment Topology

**Single Worker, same-origin.** The `learwizai-api` Worker serves both the API and the SPA:

- `assets.directory` → `apps/web/dist`, `assets.binding` → `ASSETS`
- `assets.not_found_handling` → `single-page-application`
- `run_worker_first` → `["/api/*"]`

Rationale: HttpOnly session cookies (§47.9) work same-origin with no CORS/CSRF split; one rate-limit layer; one deploy pipeline. `apps/web` and `workers/api` remain separate packages — the topology can be split into two Workers later if needed, without restructuring the monorepo.

Environments (single `wrangler.jsonc`):

| Environment | Config block | Worker name | URL (initial) |
|---|---|---|---|
| production | top-level | `learwizai-api` | `learwizai-api.<account-subdomain>.workers.dev` |
| staging | `env.staging` | `learwizai-api-staging` | `learwizai-api-staging.<account-subdomain>.workers.dev` |
| dev | `env.dev` | `learwizai-api-dev` | `learwizai-api-dev.<account-subdomain>.workers.dev` |

Binding names are identical across environments so code stays env-agnostic:

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 | Primary relational database |
| `CACHE` | KV | Rate-limit counters, cache, short-lived config |
| `DOCS` | R2 | User-uploaded documents (PDFs; used from Step 6) |
| `ASSETS` | Static assets | SPA bundle |

Later bindings (Step 6+): `VECTORS` (Vectorize), `DOC_QUEUE` (Queues producer), `AI` (Workers AI).

## 6. Cloudflare Resources

Provisioned via Cloudflare MCP (one-time; IDs committed to `wrangler.jsonc` as source of truth):

| Resource | dev | staging | prod |
|---|---|---|---|
| D1 (`primary_location_hint: weur`) | `learwizai-db-dev` | `learwizai-db-staging` | `learwizai-db-prod` |
| KV namespace | `learwizai-kv-dev` | `learwizai-kv-staging` | `learwizai-kv-prod` |
| R2 bucket | `learwizai-docs-dev` | `learwizai-docs-staging` | `learwizai-docs-prod` |

- All resources are free-tier while empty/low-use; no billing impact at MVP scale.
- `weur` chosen as a balanced global hub (NA/EU/MEA/India). D1 location hint is changeable later via `wrangler d1 update` without data migration.
- R2 and KV have no location decision (R2 is globally distributed; KV replicates reads to the edge).
- Environment isolation per §39.5: dev experiments never touch staging/prod resources.

## 7. CI/CD

`.github/workflows/ci.yml`:

```
on: pull_request, push to main

checks (every PR + main):
  1. pnpm install --frozen-lockfile
  2. typecheck  (tsc --noEmit, all packages)
  3. lint       (eslint + prettier check)
  4. test       (vitest, incl. worker integration tests)
  5. build      (web bundle + worker bundle)
  6. migration validation (wrangler d1 migrations apply --local; never touches remote)

deploy-staging:
  - only on push to main; after checks pass
  - wrangler deploy --env staging

deploy-production:
  - manual only (workflow_dispatch) + GitHub environment protection (required reviewers)
  - wrangler deploy (top-level config)
```

Secrets (GitHub Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Per CLAUDE.md §19/§26: no other secrets until the features that need them (Polar, Google OAuth in later steps).

Rollback (§39.8): redeploy previous known-good version (`wrangler versions` / redeploy prior commit). No destructive DB changes exist in Step 1.

## 8. Testing & Quality (Step 1 scope)

- Vitest configured at root; each package exposes a `test` script.
- Worker integration test: `GET /api/health` via `@cloudflare/vitest-pool-workers` (miniflare) with locally simulated `DB`/`CACHE`/`DOCS` bindings — no production credentials in CI (§43.3).
- `packages/validation`: one representative zod schema + unit test to prove the test pipeline end-to-end.
- ESLint (typescript-eslint recommended + react-hooks) and Prettier enforced in CI.
- Playwright E2E deferred to the testing-infrastructure item (§48 item 4); CI structure leaves room for a `test-e2e` job.

## 9. Delivery Phases

| # | Phase | Output | Verification |
|---|---|---|---|
| 1 | git init (`main`) + monorepo skeleton | workspace files, tsconfig.base, eslint, prettier, .gitignore, root scripts | `pnpm install` + `pnpm typecheck` pass locally |
| 2 | `packages/*` | config, types, validation (+ smoke test) | `pnpm test` passes |
| 3 | `workers/api` | Hono app, `/api/health`, worker test, `wrangler.jsonc` (env blocks, placeholder IDs) | worker test green; `wrangler dev` responds 200 |
| 4 | `apps/web` | Vite + React + Tailwind v4, minimal status page calling `/api/health` | `pnpm build` produces dist; local preview works |
| 5 | GitHub + CI | private repo `learnwiz-ai`, ci.yml, first green pipeline | CI checks green on main |
| 6 | Provision via MCP | D1×3 (`weur`), KV×3, R2×3; IDs written to `wrangler.jsonc`; commit | resource list matches naming table; IDs committed |
| 7 | Deploy | dev → staging → production | `/api/health` returns 200 on all three workers.dev URLs |
| 8 | Docs | README, `docs/architecture.md`, `docs/deployment.md`, `docs/runbooks/` skeleton | links resolve; runbook placeholders per §43 |

Prerequisites (verified 2026-09-11): `gh` CLI 2.90.0 authenticated as `orhankeskin453` (scopes: `repo`, `workflow`); Cloudflare MCP servers authenticated; Node v24.15.0, pnpm 11.24.0, git 2.54.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| D1 location hint suboptimal for future traffic mix | Hint changeable without data migration (`wrangler d1 update`) |
| Single-Worker topology constrains scaling | Split later: assets detachable from worker config without monorepo changes |
| Provisioning drift (account vs config) | IDs committed to `wrangler.jsonc`; provisioning is one-time in Phase 6; CI deploys only from committed config |
| pnpm/lockfile friction in CI | `--frozen-lockfile` from the first pipeline; `packageManager` pinned |
| Accidental prod mutation during development | Prod deploys manual-only with environment protection; migration validation is local-only in CI |

## 11. Definition of Done (Step 1)

- CI green on `main` (typecheck, lint, test, build, migration validation).
- `/api/health` returns 200 on dev, staging, and production workers.dev URLs.
- `wrangler.jsonc` env blocks contain real resource IDs matching the naming table.
- Docs skeleton committed; README explains setup + deploy flow.
- No secrets in the repository (§19/§26).
