# Deployment

## Flow (CLAUDE.md §26-27, §39.6)

```text
PR → CI checks (typecheck/lint/format/build/test/migration validation)
merge to main → CI checks → automatic staging deploy
production → manual: Actions → CI → Run workflow (deploy_production=true) → deploy
```

**Production gate note:** the `production` GitHub environment exists (deployment history is recorded), but required-reviewer protection is unavailable on the GitHub Free plan for private repositories. The manual dispatch itself is therefore the production gate. Upgrade path: GitHub Team plan (or a public repo) → Settings → Environments → production → add required reviewers.

## Local deploys (exceptional use only)

```bash
pnpm --filter @learwizai/api exec wrangler login   # once
pnpm build
pnpm --filter @learwizai/api deploy:dev
```

Production is NOT deployed locally — always through the protected CI path.

## Credentials

- CI: GitHub secrets `CLOUDFLARE_API_TOKEN` (custom token: Workers Scripts/KV/D1/R2 Edit, Memberships Read) and `CLOUDFLARE_ACCOUNT_ID`.
- Local: `wrangler login` OAuth. No tokens in the repo, ever (§19).

## Database migrations

- Files: `db/migrations/` (versioned, committed, reviewed — §39.7).
- CI validates by applying to a LOCAL D1 (`pnpm --filter @learwizai/api db:validate`); CI never touches remote D1 outside deploy jobs.
- Remote apply (when the first real migration lands): staging first, verify, then production, inside the deploy step or manually with `wrangler d1 migrations apply <db> --remote --env <env>`.

## Rollback (§39.8)

- Application: redeploy the previous known-good version —
  `wrangler deployments list` + `wrangler rollback <version-id>` (run from `workers/api`), or re-run the last green production workflow.
- Database: no destructive migrations exist yet; when they do, additive-first (§39.7) and a documented recovery plan are required BEFORE the deploy.

## Smoke test

`GET /api/health` must return `{"status":"ok",...,"checks":{"db":"ok"}}` with the
matching `environment` value on:

- dev: https://learwizai-api-dev.orhankeskinn1.workers.dev/api/health
- staging: https://learwizai-api-staging.orhankeskinn1.workers.dev/api/health
- production: https://learwizai-api.orhankeskinn1.workers.dev/api/health

If your network blackholes the `*.workers.dev` edge IP range (some ISP routes drop TCP to 188.114.96.0/24 while the `workers.dev` apex on other Cloudflare ranges works), verify via SNI forcing:

```powershell
$apexIp = curl.exe -s -o NUL -w "%{remote_ip}" --max-time 10 https://workers.dev
curl.exe -s --max-time 15 --resolve "learwizai-api.orhankeskinn1.workers.dev:443:$apexIp" https://learwizai-api.orhankeskinn1.workers.dev/api/health
```
