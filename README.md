# LearWizAI

AI-powered personal learning platform — "Learn → Understand → Practice → Feedback → Mastery → Recommendation".
The single source of truth for product/architecture rules is [CLAUDE.md](CLAUDE.md).

## Stack

React 19 + Vite 7 + Tailwind 4 (SPA) · Hono on Cloudflare Workers · D1 · KV · R2 ·
TypeScript strict · pnpm workspaces · Vitest · GitHub Actions.

## Prerequisites

- Node >= 24, pnpm 11 (`corepack enable` reads `packageManager`)
- `wrangler login` (Cloudflare OAuth) for local dev/deploy
- `gh` CLI authenticated for repo/CI operations

## Quick start

```bash
pnpm install
pnpm dev        # web on :5173 (proxies /api) + worker on :8787
```

## Scripts

| Command                                    | What it does                                           |
| ------------------------------------------ | ------------------------------------------------------ |
| `pnpm dev`                                 | Vite dev server + `wrangler dev --env dev` in parallel |
| `pnpm typecheck`                           | `tsc --noEmit` across all packages                     |
| `pnpm lint`                                | ESLint (flat config)                                   |
| `pnpm format` / `format:check`             | Prettier write / CI check                              |
| `pnpm build`                               | Web bundle → worker dry-run bundle (ordered)           |
| `pnpm test`                                | Vitest (unit + worker integration via miniflare)       |
| `pnpm --filter @learwizai/api db:validate` | Apply D1 migrations to a LOCAL database (never remote) |

## Layout

```text
apps/web        # SPA (placeholder status page until Step 2 design system)
workers/api     # Hono worker: /api/* + static assets (same-origin)
packages/types  # shared domain contracts (frontend <-> backend)
packages/validation  # zod schemas locked to shared types
packages/config # shared tsconfig presets
db/migrations   # versioned D1 migrations (first lands with auth)
docs/           # architecture, deployment, runbooks
```

## Environments

| Env        | Worker                  | URL                                                     |
| ---------- | ----------------------- | ------------------------------------------------------- |
| dev        | `learwizai-api-dev`     | https://learwizai-api-dev.orhankeskinn1.workers.dev     |
| staging    | `learwizai-api-staging` | https://learwizai-api-staging.orhankeskinn1.workers.dev |
| production | `learwizai-api`         | https://learwizai-api.orhankeskinn1.workers.dev         |

## Deployment

- **staging:** automatic on push to `main` (after CI checks pass).
- **production:** manual — Actions → CI → "Run workflow" with `deploy_production=true`; the dispatch itself is the production gate (required-reviewer protection is unavailable on GitHub Free for private repos — see [docs/deployment.md](docs/deployment.md)).
- Details + rollback: [docs/deployment.md](docs/deployment.md).
