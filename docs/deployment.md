# Deployment

## Flow (CLAUDE.md §26-27, §39.6)

```text
PR → CI checks (typecheck/lint/format/build/test/migration validation)
merge to main → CI checks → automatic staging deploy
production → manual: Actions → CI → Run workflow (deploy_production=true) → deploy
```

The repository is intended to be public. Keep Cloudflare credentials only in
GitHub Actions secrets and Worker secrets; never commit them to the repository.
After making the repository public, configure at least one required reviewer on
the `production` environment so the manual production workflow remains an
explicit approval gate.

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

- dev: https://learnwizai-api-dev.orhankeskinn1.workers.dev/api/health
- staging: https://learnwizai-api-staging.orhankeskinn1.workers.dev/api/health
- production: https://learnwizai-api.orhankeskinn1.workers.dev/api/health

If your network blackholes the `*.workers.dev` edge IP range (some ISP routes drop TCP to 188.114.96.0/24 while the `workers.dev` apex on other Cloudflare ranges works), verify via SNI forcing:

```powershell
$apexIp = curl.exe -s -o NUL -w "%{remote_ip}" --max-time 10 https://workers.dev
curl.exe -s --max-time 15 --resolve "learnwizai-api.orhankeskinn1.workers.dev:443:$apexIp" https://learnwizai-api.orhankeskinn1.workers.dev/api/health
```
