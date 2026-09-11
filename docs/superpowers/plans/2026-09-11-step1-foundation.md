# LearWizAI Step 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete LearWizAI foundation: pnpm monorepo, typed packages, Hono Worker with `/api/health`, Vite/React/Tailwind placeholder SPA, private GitHub repo with CI, provisioned Cloudflare resources (D1/KV/R2 × dev/staging/prod), and deployed environments.

**Architecture:** Single Cloudflare Worker (`learwizai-api`) serves `/api/*` (Hono) and the SPA (Workers Static Assets, same-origin). One `wrangler.jsonc`: top-level = production, `env.staging`, `env.dev`. Internal workspace packages export TypeScript source directly (no package build step); bundlers (Vite, wrangler/esbuild) compile them.

**Tech Stack:** Node 24, pnpm 11 workspaces, TypeScript 5 (strict), Hono 4, zod 4, React 19, Vite 7, Tailwind 4, Vitest 3 + @cloudflare/vitest-pool-workers, Wrangler 4, GitHub Actions, Cloudflare MCP (provisioning).

**Spec:** `docs/superpowers/specs/2026-09-11-step1-foundation-design.md` (read it first; this plan argues from it)

**Deviation from spec §9 (documented):** Phases 5 and 6 are swapped — Cloudflare provisioning (Task 7 here) happens BEFORE the GitHub push (Task 8 here). Reason: pushing `main` triggers the automatic staging deploy; deploying with placeholder resource IDs would fail against the Cloudflare API. Provisioning first means the first pipeline run is green.

## Global Constraints

Copied verbatim from the spec — every task must honor these:

- Node >= 24 (installed: v24.15.0); pnpm pinned via `"packageManager": "pnpm@11.24.0"` in root `package.json`.
- TypeScript `strict: true` everywhere; explicit types over `any` (CLAUDE.md §23).
- Resource names exactly: `learwizai-db-{dev,staging,prod}` (D1, hint `weur`), `learwizai-kv-{dev,staging,prod}` (KV), `learwizai-docs-{dev,staging,prod}` (R2).
- Worker names exactly: `learwizai-api` (prod = top-level config), `learwizai-api-staging` (`env.staging`), `learwizai-api-dev` (`env.dev`).
- Binding names identical in all environments: `DB` (D1), `CACHE` (KV), `DOCS` (R2), `ASSETS` (static assets).
- No secrets in the repository (CLAUDE.md §19/§26). Cloudflare credentials: `wrangler login` OAuth locally; `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as GitHub secrets in CI.
- Production deploys are manual-only (`workflow_dispatch` + GitHub environment protection with required reviewer). Staging deploys automatically on push to `main`.
- CI migration validation is LOCAL-only (`wrangler d1 migrations apply ... --local`); CI never touches remote D1 except via deploy jobs.
- Placeholder status page keeps copy in one temporary constants file with EN + TR values (default EN); real i18n lands in Step 2 (CLAUDE.md §6).
- Every task ends with: `pnpm format` (prettier write), then commit. CI enforces `format:check`, so unformatted files break the pipeline.
- Package scope is `@learwizai/*`; internal packages are consumed as TS source via `exports` maps (no build step for `packages/*`).
- Version note: dependency versions below use `^` ranges current as of 2026-09. If a range fails to resolve or a peer conflict appears (notably vitest ↔ @cloudflare/vitest-pool-workers), install the latest compatible pair and record the resolved versions in the task commit message.

---

### Task 1: Monorepo skeleton (root toolchain)

**Files:**
- Create: `.gitignore`, `.gitattributes`, `.prettierrc`, `.prettierignore`, `pnpm-workspace.yaml`, `package.json`, `eslint.config.js`
- Create: `db/migrations/.gitkeep`, `db/seed/.gitkeep`
- Modify (formatting only, via `pnpm format`): `CLAUDE.md`, `.mcp.json`, `docs/superpowers/specs/2026-09-11-step1-foundation-design.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: root scripts `dev`, `typecheck`, `lint`, `format`, `format:check`, `build`, `test` (used by CI in Task 8 and by every later task); pnpm workspace globs `apps/*`, `workers/*`, `packages/*`; `db/migrations/` directory (referenced by `wrangler.jsonc` in Task 6).

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
.wrangler/
coverage/
*.local
.dev.vars
.env
.DS_Store
*.log
```

- [ ] **Step 2: Create `.gitattributes`** (kills the LF→CRLF warnings on Windows)

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 4: Create `.prettierignore`**

```text
pnpm-lock.yaml
node_modules
dist
.wrangler
coverage
```

- [ ] **Step 5: Create `pnpm-workspace.yaml`**

`onlyBuiltDependencies` whitelists postinstall scripts (pnpm ≥10 blocks them by default): esbuild (Vite), workerd (vitest pool-workers), unrs-resolver (typescript-eslint).

```yaml
packages:
  - "apps/*"
  - "workers/*"
  - "packages/*"

onlyBuiltDependencies:
  - esbuild
  - unrs-resolver
  - workerd
```

- [ ] **Step 6: Create root `package.json`**

`build` uses explicit ordering: web must produce `dist/` before the worker's dry-run build validates the assets directory.

```json
{
  "name": "learwizai",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.24.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "build": "pnpm --filter @learwizai/web build && pnpm --filter @learwizai/api build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "globals": "^16.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.0.0"
  }
}
```

- [ ] **Step 7: Create `eslint.config.js`** (flat config; react-hooks rules via explicit plugin registration so the config is plugin-version agnostic)

```js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["workers/**/*.ts"],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
);
```

- [ ] **Step 8: Create `db/migrations/.gitkeep` and `db/seed/.gitkeep`** (both empty files)

- [ ] **Step 9: Install root dev dependencies**

Run: `pnpm install`
Expected: lockfile created; eslint/prettier/typescript resolve; no build-script warnings for the whitelisted packages (none installed yet).

- [ ] **Step 10: Verify toolchain runs**

Run: `pnpm lint` → exit 0 (lints `eslint.config.js` only).
Run: `pnpm typecheck` → exit 0 (`pnpm -r` matches no packages yet — that is a pass).
Run: `pnpm format` → rewrites existing docs/config files to prettier style.
Run: `pnpm format:check` → exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo toolchain (pnpm workspaces, eslint, prettier, tsconfig base)"
```

---

### Task 2: packages/config — shared TypeScript configs

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/tsconfig.react.json`
- Create: `packages/config/tsconfig.worker.json`

**Interfaces:**
- Consumes: pnpm workspace glob `packages/*` (Task 1).
- Produces: config entry points `@learwizai/config/tsconfig.base.json`, `@learwizai/config/tsconfig.react.json`, `@learwizai/config/tsconfig.worker.json` — extended by Tasks 3, 4, 5, 6 via their `tsconfig.json` `extends` field.

Note: the spec lists "eslint preset" under packages/config; for Step 1 the single root `eslint.config.js` (Task 1) covers the whole repo. Moving lint presets into the package is deferred until a second lintable app exists (YAGNI).

- [ ] **Step 1: Create `packages/config/package.json`**

```json
{
  "name": "@learwizai/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.react.json": "./tsconfig.react.json",
    "./tsconfig.worker.json": "./tsconfig.worker.json"
  }
}
```

- [ ] **Step 2: Create `packages/config/tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Create `packages/config/tsconfig.react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "useDefineForClassFields": true
  }
}
```

- [ ] **Step 4: Create `packages/config/tsconfig.worker.json`**

The `types` array registers Workers runtime globals (`D1Database`, `KVNamespace`, `R2Bucket`, `Fetcher`) and the `cloudflare:test` module used by Task 6's tests.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"]
  }
}
```

- [ ] **Step 5: Verify install wiring**

Run: `pnpm install`
Expected: `@learwizai/config` appears as a workspace package (no dependencies to fetch).

- [ ] **Step 6: Format + commit**

```bash
pnpm format
git add packages/config pnpm-lock.yaml
git commit -m "feat(config): shared strict tsconfig presets (base/react/worker)"
```

---

### Task 3: packages/types — shared domain contracts

**Files:**
- Create: `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/src/index.ts`

**Interfaces:**
- Consumes: `@learwizai/config/tsconfig.base.json` (Task 2).
- Produces: `@learwizai/types` exporting `type Locale = "en" | "tr"` and `interface HealthResponse { status: "ok"; service: "learwizai-api"; environment: string; timestamp: string; checks: { db: "ok" | "unavailable" } }`. Consumed by Task 4 (validation), Task 5 (web), Task 6 (worker + tests).

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@learwizai/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@learwizai/config": "workspace:*",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "extends": "@learwizai/config/tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

```ts
/** Locales supported at launch (CLAUDE.md §6). English is the fallback. */
export type Locale = "en" | "tr";

/** Response body of GET /api/health (CLAUDE.md Step 1 foundation). */
export interface HealthResponse {
  status: "ok";
  service: "learwizai-api";
  environment: string;
  timestamp: string;
  checks: {
    db: "ok" | "unavailable";
  };
}
```

- [ ] **Step 4: Install + verify**

Run: `pnpm install`
Run: `pnpm --filter @learwizai/types typecheck`
Expected: exit 0.

- [ ] **Step 5: Format + commit**

```bash
pnpm format
git add packages/types pnpm-lock.yaml
git commit -m "feat(types): shared Locale and HealthResponse contracts"
```

---

### Task 4: packages/validation — zod schemas (TDD)

**Files:**
- Create: `packages/validation/package.json`, `packages/validation/tsconfig.json`
- Test: `packages/validation/test/locale.test.ts`
- Create: `packages/validation/src/index.ts`

**Interfaces:**
- Consumes: `@learwizai/types` `Locale` (Task 3), `@learwizai/config/tsconfig.base.json` (Task 2).
- Produces: `@learwizai/validation` exporting `localeSchema` (zod enum `["en","tr"]`, compile-time-locked to `Locale` via `satisfies`) and re-exported `type Locale`. This is the seed of the shared request/response contract layer (CLAUDE.md §40.6).

- [ ] **Step 1: Create `packages/validation/package.json`**

```json
{
  "name": "@learwizai/validation",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@learwizai/types": "workspace:*",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@learwizai/config": "workspace:*",
    "typescript": "^5.9.2",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `packages/validation/tsconfig.json`**

```json
{
  "extends": "@learwizai/config/tsconfig.base.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Write the failing test `packages/validation/test/locale.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { localeSchema } from "../src/index";

describe("localeSchema", () => {
  it("accepts supported locales", () => {
    expect(localeSchema.parse("en")).toBe("en");
    expect(localeSchema.parse("tr")).toBe("tr");
  });

  it("rejects unsupported locales", () => {
    expect(localeSchema.safeParse("de").success).toBe(false);
    expect(localeSchema.safeParse("").success).toBe(false);
    expect(localeSchema.safeParse(42).success).toBe(false);
  });
});
```

- [ ] **Step 4: Install, then run the test to verify it FAILS**

Run: `pnpm install`
Run: `pnpm --filter @learwizai/validation test`
Expected: FAIL — cannot resolve `../src/index` (module does not exist yet).

- [ ] **Step 5: Implement `packages/validation/src/index.ts`**

```ts
import { z } from "zod";
import type { Locale } from "@learwizai/types";

/**
 * Supported UI locales (CLAUDE.md §6). The `satisfies` clause keeps this
 * schema and the shared `Locale` type in sync at compile time — if either
 * side drifts, `pnpm typecheck` fails (contract testing per §40.6).
 */
export const localeSchema = z.enum(["en", "tr"]) satisfies z.ZodType<Locale>;

export type { Locale };
```

- [ ] **Step 6: Run test to verify it PASSES**

Run: `pnpm --filter @learwizai/validation test`
Expected: PASS (2 tests).

Run: `pnpm --filter @learwizai/validation typecheck`
Expected: exit 0 (proves the `satisfies` contract holds).

- [ ] **Step 7: Format + commit**

```bash
pnpm format
git add packages/validation pnpm-lock.yaml
git commit -m "feat(validation): locale schema locked to shared Locale type (TDD)"
```

---

### Task 5: apps/web — Vite + React + Tailwind placeholder status page

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/copy.ts`, `apps/web/src/index.css`, `apps/web/src/vite-env.d.ts`

**Interfaces:**
- Consumes: `@learwizai/types` `HealthResponse` (Task 3), `@learwizai/config/tsconfig.react.json` (Task 2).
- Produces: build artifact `apps/web/dist/` — REQUIRED to exist before Task 6's worker tests and dry-run build run (the `assets.directory` in `wrangler.jsonc` points at it). Dev server on :5173 proxying `/api` → :8787 (wrangler dev).

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@learwizai/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@learwizai/types": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@learwizai/config": "workspace:*",
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.2",
    "vite": "^7.0.0"
  }
}
```

Version contingency: if `@vitejs/plugin-react@^5` and `vite@^7` do not resolve together, install the latest stable pair (`pnpm add -D vite @vitejs/plugin-react` inside `apps/web`) and note resolved versions in the commit message.

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "@learwizai/config/tsconfig.react.json",
  "include": ["src"],
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 3: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LearWizAI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local dev: wrangler dev serves the API on :8787 (see root `pnpm dev`).
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 5: Create `apps/web/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Create `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create `apps/web/src/copy.ts`**

Temporary single-file copy map (EN default, TR included). Step 2 replaces this with the real i18n foundation — the comment marks it so the "no hardcoded strings" rule (§23) has a tracked, bounded exception.

```ts
/**
 * TEMPORARY Step 1 placeholder copy.
 * Step 2 introduces the i18n foundation (CLAUDE.md §6) and this file is
 * replaced by apps/web/src/i18n/locales/{en,tr}/*.json. Do not grow it.
 */
export const STATUS_PAGE_COPY = {
  en: {
    title: "LearWizAI",
    subtitle: "Foundation status",
    loading: "Checking API…",
    apiOk: "API reachable",
    apiDown: "API unreachable",
    env: "Environment",
    db: "Database",
  },
  tr: {
    title: "LearWizAI",
    subtitle: "Temel durum",
    loading: "API kontrol ediliyor…",
    apiOk: "API erişilebilir",
    apiDown: "API erişilemiyor",
    env: "Ortam",
    db: "Veritabanı",
  },
} as const;
```

- [ ] **Step 8: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Create `apps/web/src/App.tsx`**

Loading/error/ready states per CLAUDE.md §29. Colors use Tailwind defaults matching the §8.2 palette (slate-50 background `#F8FAFC`, slate-900 text `#0F172A`).

```tsx
import { useEffect, useState } from "react";
import type { HealthResponse } from "@learwizai/types";
import { STATUS_PAGE_COPY } from "./copy";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: HealthResponse };

const copy = STATUS_PAGE_COPY.en; // Step 2: locale-aware selection replaces this.

export default function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as HealthResponse;
      })
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-slate-900">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="text-sm text-slate-500">{copy.subtitle}</p>
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
        {state.kind === "loading" && <p className="text-slate-500">{copy.loading}</p>}
        {state.kind === "error" && <p className="text-red-600">{copy.apiDown}</p>}
        {state.kind === "ready" && (
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">API</dt>
              <dd className="font-medium text-emerald-600">{copy.apiOk}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{copy.env}</dt>
              <dd className="font-medium">{state.data.environment}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{copy.db}</dt>
              <dd className="font-medium">{state.data.checks.db}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 10: Install + build + verify**

Run: `pnpm install`
Run: `pnpm --filter @learwizai/web build`
Expected: exit 0; `apps/web/dist/index.html` and hashed assets exist. (The page shows "API unreachable" when opened without the worker — that is the correct error state; the full loop is smoke-tested in Task 9.)

Run: `pnpm --filter @learwizai/web typecheck` → exit 0.
Run: `pnpm lint` → exit 0 (react-hooks rules apply to `apps/web/**`).

- [ ] **Step 11: Format + commit**

```bash
pnpm format
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): placeholder status page (Vite + React + Tailwind v4)"
```

---

### Task 6: workers/api — Hono worker with /api/health (TDD) + wrangler config

**Files:**
- Create: `workers/api/package.json`, `workers/api/tsconfig.json`, `workers/api/vitest.config.ts`, `workers/api/wrangler.jsonc`
- Create: `workers/api/src/index.ts` (stub first, then final)
- Test: `workers/api/test/health.test.ts`
- Create: `workers/api/src/env.ts`, `workers/api/src/routes/health.ts`

**Interfaces:**
- Consumes: `@learwizai/types` `HealthResponse` (Task 3), `@learwizai/config/tsconfig.worker.json` (Task 2), `apps/web/dist/` must exist (Task 5 — the assets binding points at it), `db/migrations/` (Task 1).
- Produces: default-exported Hono `app` (fetch handler) mounted at basePath `/api`; routes: `GET /api/health` → `HealthResponse`; 404 JSON for unknown `/api/*`. npm scripts consumed later: `dev` (Task 9), `build` (root build, CI), `deploy:dev|deploy:staging|deploy:prod` (CI Task 8, Task 9), `db:validate` (CI Task 8). `Env` interface: `{ ENVIRONMENT: string; DB: D1Database; CACHE: KVNamespace; DOCS: R2Bucket; ASSETS: Fetcher }`.

- [ ] **Step 1: Create `workers/api/package.json`**

```json
{
  "name": "@learwizai/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --env dev",
    "build": "wrangler deploy --dry-run --outdir dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "deploy:dev": "wrangler deploy --env dev",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:prod": "wrangler deploy",
    "db:validate": "wrangler d1 migrations apply learwizai-db-dev --env dev --local --persist-to .wrangler/state"
  },
  "dependencies": {
    "@learwizai/types": "workspace:*",
    "hono": "^4.8.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "@learwizai/config": "workspace:*",
    "typescript": "^5.9.2",
    "vitest": "^3.2.0",
    "wrangler": "^4.30.0"
  }
}
```

Peer contingency: if `@cloudflare/vitest-pool-workers` reports a vitest peer conflict, install the vitest major it supports (check its package.json `peerDependencies`) and adjust both devDependencies together.

- [ ] **Step 2: Create `workers/api/tsconfig.json`**

```json
{
  "extends": "@learwizai/config/tsconfig.worker.json",
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `workers/api/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
```

- [ ] **Step 4: Create `workers/api/wrangler.jsonc`** (placeholder IDs — replaced with real ones in Task 7; format-valid zero UUIDs keep local tooling and `--dry-run` happy)

```jsonc
{
  // LearWizAI API Worker — single worker serving /api/* and the SPA assets.
  // Top-level config = production. env.staging / env.dev = other environments.
  // See docs/superpowers/specs/2026-09-11-step1-foundation-design.md §5-§6.
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "learwizai-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "vars": { "ENVIRONMENT": "production" },
  "observability": { "enabled": true },
  "assets": {
    "directory": "../../apps/web/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "learwizai-db-prod",
      // PLACEHOLDER — replaced with the real ID in Task 7 (provisioning)
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "../../db/migrations"
    }
  ],
  "kv_namespaces": [
    { "binding": "CACHE", "id": "00000000-0000-0000-0000-000000000000" }
  ],
  "r2_buckets": [{ "binding": "DOCS", "bucket_name": "learwizai-docs-prod" }],
  "env": {
    "staging": {
      "name": "learwizai-api-staging",
      "vars": { "ENVIRONMENT": "staging" },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "learwizai-db-staging",
          "database_id": "00000000-0000-0000-0000-000000000000",
          "migrations_dir": "../../db/migrations"
        }
      ],
      "kv_namespaces": [
        { "binding": "CACHE", "id": "00000000-0000-0000-0000-000000000000" }
      ],
      "r2_buckets": [{ "binding": "DOCS", "bucket_name": "learwizai-docs-staging" }]
    },
    "dev": {
      "name": "learwizai-api-dev",
      "vars": { "ENVIRONMENT": "dev" },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "learwizai-db-dev",
          "database_id": "00000000-0000-0000-0000-000000000000",
          "migrations_dir": "../../db/migrations"
        }
      ],
      "kv_namespaces": [
        { "binding": "CACHE", "id": "00000000-0000-0000-0000-000000000000" }
      ],
      "r2_buckets": [{ "binding": "DOCS", "bucket_name": "learwizai-docs-dev" }]
    }
  }
}
```

- [ ] **Step 5: Create stub `workers/api/src/index.ts`** (deliberately WITHOUT the health route, so the test fails first)

```ts
import { Hono } from "hono";

const app = new Hono();

export default app;
```

- [ ] **Step 6: Install deps**

Run: `pnpm install`
Expected: hono, wrangler, vitest, pool-workers install; workerd/esbuild postinstall allowed by the Task 1 whitelist. If pnpm still flags ignored build scripts, run `pnpm approve-builds` and allow `esbuild`, `workerd`, `unrs-resolver`.

- [ ] **Step 7: Write the failing test `workers/api/test/health.test.ts`**

```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { HealthResponse } from "@learwizai/types";

describe("GET /api/health", () => {
  it("returns 200 with service identity and a passing db check", async () => {
    const response = await SELF.fetch("http://local/api/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("learwizai-api");
    expect(body.checks.db).toBe("ok");
    expect(typeof body.environment).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns JSON 404 for unknown /api routes", async () => {
    const response = await SELF.fetch("http://local/api/does-not-exist");
    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });
});
```

- [ ] **Step 8: Run the test to verify it FAILS**

Run: `pnpm --filter @learwizai/api test`
Expected: FAIL — first test gets 404 (route not implemented). The test run uses the top-level wrangler config with minifare-simulated D1/KV/R2; placeholder IDs are fine locally. Requires `apps/web/dist/` to exist (built in Task 5).

- [ ] **Step 9: Implement `workers/api/src/env.ts`**

```ts
/**
 * Runtime bindings for the API worker.
 * Names are identical across dev/staging/production (see wrangler.jsonc).
 */
export interface Env {
  /** Deploy environment name: "dev" | "staging" | "production". */
  ENVIRONMENT: string;
  /** D1 primary relational database (CLAUDE.md §12.1, §16). */
  DB: D1Database;
  /** KV namespace: rate-limit counters, cache, short-lived config (§12.1). */
  CACHE: KVNamespace;
  /** R2 bucket: user-uploaded documents — used from Step 6 (§12.1). */
  DOCS: R2Bucket;
  /** SPA static assets (same-origin deployment, spec §5). */
  ASSETS: Fetcher;
}
```

- [ ] **Step 10: Implement `workers/api/src/routes/health.ts`**

```ts
import { Hono } from "hono";
import type { HealthResponse } from "@learwizai/types";
import type { Env } from "../env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/", async (c) => {
  let db: HealthResponse["checks"]["db"] = "ok";
  try {
    // SELECT 1 works on an empty database — proves the binding is live.
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    db = "unavailable";
  }

  const body: HealthResponse = {
    status: "ok",
    service: "learwizai-api",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    checks: { db },
  };
  return c.json(body);
});
```

- [ ] **Step 11: Replace `workers/api/src/index.ts` with the final app**

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { healthRoute } from "./routes/health";

// basePath keeps every route below /api/* — everything else is served by
// the static assets binding (run_worker_first in wrangler.jsonc).
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.route("/health", healthRoute);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

export default app;
```

- [ ] **Step 12: Run tests to verify they PASS**

Run: `pnpm --filter @learwizai/api test`
Expected: PASS (2 tests).

Run: `pnpm --filter @learwizai/api typecheck` → exit 0.
Run: `pnpm --filter @learwizai/api build` → dry-run bundle written to `workers/api/dist/` (gitignored); proves wrangler can bundle the worker + assets config.

- [ ] **Step 13: Verify the migration harness runs with zero migrations**

Run: `pnpm --filter @learwizai/api db:validate`
Expected: output contains "No migrations to apply" (or equivalent) and exit code 0. This proves the CI migration-validation step (Task 8) will work.

- [ ] **Step 14: Verify root aggregate scripts**

Run (repo root): `pnpm build` then `pnpm test` then `pnpm typecheck`
Expected: all exit 0 — web builds before the worker dry-run; both test packages run.

- [ ] **Step 15: Format + commit**

```bash
pnpm format
git add workers/api pnpm-lock.yaml
git commit -m "feat(api): Hono worker with /api/health, env-typed bindings, worker tests (TDD)"
```

---

### Task 7: Provision Cloudflare resources via MCP + bind real IDs

**Files:**
- Modify: `workers/api/wrangler.jsonc` (replace 3 D1 `database_id` + 3 KV `id` placeholders; remove PLACEHOLDER comments)

**Interfaces:**
- Consumes: Cloudflare MCP servers (`cloudflare-bindings` tools) authenticated; naming table from Global Constraints.
- Produces: live resources `learwizai-db-{dev,staging,prod}` (D1, weur), `learwizai-kv-{dev,staging,prod}` (KV), `learwizai-docs-{dev,staging,prod}` (R2); `wrangler.jsonc` containing their real IDs — required by Task 8 (CI staging deploy) and Task 9 (deploys).

- [ ] **Step 1: Create the three D1 databases**

Call `mcp__cloudflare-bindings__d1_database_create` three times:
- `{ "name": "learwizai-db-dev", "primary_location_hint": "weur" }`
- `{ "name": "learwizai-db-staging", "primary_location_hint": "weur" }`
- `{ "name": "learwizai-db-prod", "primary_location_hint": "weur" }`

Record each returned `uuid` (the `database_id`).

- [ ] **Step 2: Create the three KV namespaces**

Call `mcp__cloudflare-bindings__kv_namespace_create` three times:
- `{ "title": "learwizai-kv-dev" }`
- `{ "title": "learwizai-kv-staging" }`
- `{ "title": "learwizai-kv-prod" }`

Record each returned `id`.

- [ ] **Step 3: Create the three R2 buckets**

Call `mcp__cloudflare-bindings__r2_bucket_create` three times:
- `{ "name": "learwizai-docs-dev" }`
- `{ "name": "learwizai-docs-staging" }`
- `{ "name": "learwizai-docs-prod" }`

R2 contingency: on a fresh account this can fail with an "R2 is not enabled"-style error. If so: ask the user to enable R2 in the Cloudflare dashboard (free tier; may require adding a billing profile), then retry. If the user declines, remove the three `r2_buckets` blocks and the `DOCS` binding from `Env` in `workers/api/src/env.ts` + the health test stays unaffected; note the deviation in the commit message and re-add in Step 6 (RAG). Do NOT silently skip.

- [ ] **Step 4: Verify all nine resources exist**

Call `mcp__cloudflare-bindings__d1_databases_list`, `mcp__cloudflare-bindings__kv_namespaces_list`, `mcp__cloudflare-bindings__r2_buckets_list`.
Expected: 3 D1 (location hint reflected), 3 KV, 3 R2 with the exact names from the Global Constraints.

- [ ] **Step 5: Write real IDs into `workers/api/wrangler.jsonc`**

Six edits (keep everything else byte-identical):
- Top-level `d1_databases[0].database_id` → prod D1 uuid (block with `database_name: "learwizai-db-prod"`); delete the PLACEHOLDER comment line.
- Top-level `kv_namespaces[0].id` → prod KV id.
- `env.staging.d1_databases[0].database_id` → staging D1 uuid; `env.staging.kv_namespaces[0].id` → staging KV id.
- `env.dev.d1_databases[0].database_id` → dev D1 uuid; `env.dev.kv_namespaces[0].id` → dev KV id.

Sanity rule: each ID must sit in the block whose `database_name`/environment matches it — a swapped dev/prod ID is the one dangerous mistake this task can make. Re-read the file after editing and verify all six pairings.

- [ ] **Step 6: Re-verify the worker suite with real IDs**

Run: `pnpm --filter @learwizai/api test` → PASS (tests stay local via miniflare; real IDs are only format-checked).
Run: `pnpm --filter @learwizai/api build` → exit 0 (dry-run validates config).
Run: `pnpm format:check` → exit 0 (prettier formats jsonc; comments survive).

- [ ] **Step 7: Commit**

```bash
git add workers/api/wrangler.jsonc
git commit -m "chore(infra): provision D1/KV/R2 for dev+staging+prod and bind real IDs"
```

---

### Task 8: GitHub repo + CI pipeline + protected environments

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `typecheck`, `lint`, `format:check`, `build`, `test` (Task 1); `@learwizai/api` scripts `db:validate`, `deploy:staging`, `deploy:prod` (Task 6); real resource IDs committed (Task 7); `gh` CLI 2.90 authenticated as `orhankeskin453` (verified 2026-09-11).
- Produces: GitHub private repo `orhankeskin453/learnwiz-ai` with `origin` remote; secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; GitHub environments `staging` (no protection) and `production` (required reviewer); a first green pipeline that auto-deploys staging.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      deploy_production:
        description: Deploy to production
        type: boolean
        default: false

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    name: Typecheck / Lint / Build / Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm build
      - run: pnpm test
      - name: Validate D1 migrations (local only)
        run: pnpm --filter @learwizai/api db:validate

  deploy-staging:
    name: Deploy staging
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: checks
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy worker + assets
        run: pnpm --filter @learwizai/api deploy:staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-production:
    name: Deploy production
    if: github.event_name == 'workflow_dispatch' && inputs.deploy_production
    needs: checks
    runs-on: ubuntu-latest
    environment: production # protected: required reviewer approval
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Deploy worker + assets
        run: pnpm --filter @learwizai/api deploy:prod
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Format + commit locally (do NOT push yet)**

```bash
pnpm format
git add .github/workflows/ci.yml
git commit -m "ci: checks pipeline + auto staging deploy + protected production deploy"
```

- [ ] **Step 3: Create the private GitHub repo (no push)**

Run: `gh repo create learnwiz-ai --private --source . --remote origin`
Expected: repo `orhankeskin453/learnwiz-ai` created, remote `origin` added, nothing pushed yet.

- [ ] **Step 4: Set the account-ID secret**

Run: `gh secret set CLOUDFLARE_ACCOUNT_ID --body "b61e3474a67089ddc06413a847ed31c7"`

- [ ] **Step 5: USER ACTION — create the Cloudflare API token, then store it**

Ask the user to: Cloudflare dashboard → My Profile → API Tokens → Create Token → **Custom token** with permissions:
- Account · Workers Scripts · Edit
- Account · Workers KV Storage · Edit
- Account · D1 · Edit
- Account · Workers R2 Storage · Edit
- User · Memberships · Read

Account Resources: include the LearWizAI account only. No zone permissions needed.

Then (user pastes the token; do not echo it into any file or log):
Run: `gh secret set CLOUDFLARE_API_TOKEN --body "<token-from-user>"`
PAUSE here until the user confirms both secrets are set.

- [ ] **Step 6: Create GitHub environments (production protected)**

PowerShell (writes reviewer JSON without a BOM, then cleans up):

```powershell
$uid = gh api user --jq .id
[IO.File]::WriteAllText("$PWD/env-prod.json", "{""reviewers"":[{""type"":""User"",""id"":$uid}]}")
gh api -X PUT repos/orhankeskin453/learnwiz-ai/environments/production --input env-prod.json
Remove-Item env-prod.json
gh api -X PUT repos/orhankeskin453/learnwiz-ai/environments/staging
```

Verify: `gh api repos/orhankeskin453/learnwiz-ai/environments --jq ".environments[].name"` lists `production` (with reviewer) and `staging`.

- [ ] **Step 7: Push main — first pipeline run**

Run: `git push -u origin main`
Expected: push triggers CI; `checks` runs, then `deploy-staging` runs automatically.

- [ ] **Step 8: Watch the run to green**

Run: `gh run list --limit 3` then `gh run watch <run-id>` (or poll `gh run view <run-id>`).
Expected: `checks` ✓ and `deploy-staging` ✓. The staging deploy output contains the worker URL — record `https://learwizai-api-staging.<SUBDOMAIN>.workers.dev`.

Subdomain contingency: if the deploy fails with a "workers.dev subdomain" error, the account has no workers.dev subdomain yet. Register one: query `mcp__cloudflare-api__docs` for "register workers.dev subdomain" to confirm the endpoint, then call it via `mcp__cloudflare-api__execute` with subdomain `learwizai` (if taken, ask the user for an alternative). Re-run the failed job: `gh run rerun <run-id> --failed`.

Checks-job failure triage (most likely first-run issues):
- `format:check` red → run `pnpm format`, commit, push again.
- pnpm build-script warnings → ensure `onlyBuiltDependencies` (Task 1 Step 5) matches what the lockfile reports.
- frozen-lockfile mismatch → `pnpm install` locally, commit the updated lockfile.

- [ ] **Step 9: Verify nothing secret-like was committed**

Run: `git log --all -p -S "CLOUDFLARE_API_TOKEN" -- . ":(exclude).github/workflows/ci.yml"` → empty (only the workflow reference may exist).
Run: `git grep -iE "(api[_-]?token|secret)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}" -- .` → no matches.

---

### Task 9: Deploy dev + production, smoke-test all three environments

**Files:** none (operational task; URLs recorded for Task 10)

**Interfaces:**
- Consumes: `deploy:dev`/`deploy:prod` scripts (Task 6), CI workflow + environments (Task 8), staging already deployed (Task 8 Step 8).
- Produces: three live environments and their recorded URLs: `DEV_URL`, `STAGING_URL`, `PROD_URL` (each `https://<worker-name>.<SUBDOMAIN>.workers.dev`) — written into docs in Task 10. This satisfies the spec §11 Definition of Done.

- [ ] **Step 1: Ensure wrangler CLI is authenticated locally**

Run: `pnpm --filter @learwizai/api exec wrangler whoami`
If not logged in: run `pnpm --filter @learwizai/api exec wrangler login` (USER ACTION: browser OAuth completes the login), then re-check `whoami`.

- [ ] **Step 2: Build fresh artifacts**

Run: `pnpm build`
Expected: exit 0 (`apps/web/dist` + worker dry-run bundle).

- [ ] **Step 3: Deploy dev**

Run: `pnpm --filter @learwizai/api deploy:dev`
Expected: `learwizai-api-dev` deployed; output shows the workers.dev URL. Record it as `DEV_URL`.

- [ ] **Step 4: Smoke dev**

Run (PowerShell): `Invoke-RestMethod "<DEV_URL>/api/health" | ConvertTo-Json -Depth 5`
Expected: `status: "ok"`, `service: "learwizai-api"`, `environment: "dev"`, `checks.db: "ok"` (proves the real D1 binding answers `SELECT 1`).

- [ ] **Step 5: Smoke staging (deployed by CI in Task 8)**

Run: `Invoke-RestMethod "<STAGING_URL>/api/health" | ConvertTo-Json -Depth 5`
Expected: same shape, `environment: "staging"`.

- [ ] **Step 6: Deploy production through the protected path**

Run: `gh workflow run ci.yml -F deploy_production=true`
Then USER ACTION: approve the `production` environment deployment gate in the GitHub UI (Actions → run → "Review deployments"), or via `gh api -X POST repos/orhankeskin453/learnwiz-ai/actions/runs/<run-id>/pending_deployments -f "environment_ids[]=..."` if preferred.
Watch: `gh run watch <run-id>` → `checks` ✓, `deploy-production` ✓.

This deliberately exercises the real production path (dispatch + approval + CI deploy) instead of a local `deploy:prod`, per spec §7.

- [ ] **Step 7: Smoke production**

Run: `Invoke-RestMethod "<PROD_URL>/api/health" | ConvertTo-Json -Depth 5`
Expected: same shape, `environment: "production"`.

- [ ] **Step 8: Record results**

Write down for Task 10: `DEV_URL`, `STAGING_URL`, `PROD_URL`, the workers.dev `<SUBDOMAIN>`, and the production run id (evidence for the DoD). No commit in this task.

---

### Task 10: Docs skeleton + final verification

**Files:**
- Create: `README.md`, `docs/architecture.md`, `docs/deployment.md`
- Create: `docs/runbooks/ai-outage.md`, `docs/runbooks/billing-webhook-failure.md`, `docs/runbooks/queue-backlog.md`, `docs/runbooks/database-incident.md`

**Interfaces:**
- Consumes: recorded URLs/subdomain from Task 9.
- Produces: §44-compliant docs skeleton; final green pipeline on `main`.

- [ ] **Step 1: Create `README.md`** (substitute the real `<SUBDOMAIN>` recorded in Task 9)

````markdown
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

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server + `wrangler dev --env dev` in parallel |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm lint` | ESLint (flat config) |
| `pnpm format` / `format:check` | Prettier write / CI check |
| `pnpm build` | Web bundle → worker dry-run bundle (ordered) |
| `pnpm test` | Vitest (unit + worker integration via miniflare) |
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

| Env | Worker | URL |
| --- | --- | --- |
| dev | `learwizai-api-dev` | https://learwizai-api-dev.<SUBDOMAIN>.workers.dev |
| staging | `learwizai-api-staging` | https://learwizai-api-staging.<SUBDOMAIN>.workers.dev |
| production | `learwizai-api` | https://learwizai-api.<SUBDOMAIN>.workers.dev |

## Deployment

- **staging:** automatic on push to `main` (after CI checks pass).
- **production:** manual — Actions → CI → "Run workflow" with `deploy_production=true`, then approve the protected `production` environment gate.
- Details + rollback: [docs/deployment.md](docs/deployment.md).
````

- [ ] **Step 2: Create `docs/architecture.md`** (substitute `<SUBDOMAIN>`)

````markdown
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

| Env | Worker | D1 (weur) | KV | R2 |
| --- | --- | --- | --- | --- |
| dev | learwizai-api-dev | learwizai-db-dev | learwizai-kv-dev | learwizai-docs-dev |
| staging | learwizai-api-staging | learwizai-db-staging | learwizai-kv-staging | learwizai-docs-staging |
| production | learwizai-api | learwizai-db-prod | learwizai-kv-prod | learwizai-docs-prod |

Resource IDs live in `workers/api/wrangler.jsonc` (committed source of truth).
URLs: `https://<worker>.<SUBDOMAIN>.workers.dev`.

## Monorepo

pnpm workspaces; internal packages export TypeScript source (bundlers compile).
`packages/validation` schemas are compile-time-locked to `packages/types` via
`satisfies` — cross-layer contract drift fails `pnpm typecheck` (CLAUDE.md §40.6).

## Planned additions (not yet deployed)

- Vectorize index + Queues producer/consumer (Step 6 — RAG)
- Workers AI binding + AI Router (Step 6-7 per §48)
- Email Service, Polar billing, Analytics Engine (later steps)

Design decisions and rationale: `docs/superpowers/specs/2026-09-11-step1-foundation-design.md`.
````

- [ ] **Step 3: Create `docs/deployment.md`** (substitute `<SUBDOMAIN>`)

````markdown
# Deployment

## Flow (CLAUDE.md §26-27, §39.6)

```text
PR → CI checks (typecheck/lint/format/build/test/migration validation)
merge to main → CI checks → automatic staging deploy
production → manual: Actions → CI → Run workflow (deploy_production=true)
           → required-reviewer approval on the "production" environment → deploy
```

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

- dev: https://learwizai-api-dev.<SUBDOMAIN>.workers.dev/api/health
- staging: https://learwizai-api-staging.<SUBDOMAIN>.workers.dev/api/health
- production: https://learwizai-api.<SUBDOMAIN>.workers.dev/api/health
````

- [ ] **Step 4: Create the four runbook skeletons** — identical structure, content differs per incident. Each file:

`docs/runbooks/ai-outage.md`:

```markdown
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
```

`docs/runbooks/billing-webhook-failure.md`:

```markdown
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
```

`docs/runbooks/queue-backlog.md`:

```markdown
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
```

`docs/runbooks/database-incident.md`:

```markdown
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
```

- [ ] **Step 5: Final full verification pass**

Run (repo root): `pnpm typecheck` → 0 · `pnpm lint` → 0 · `pnpm format` then `pnpm format:check` → 0 · `pnpm build` → 0 · `pnpm test` → all pass.

- [ ] **Step 6: Commit + push**

```bash
git add README.md docs/
git commit -m "docs: README, architecture, deployment and runbook skeletons"
git push
```

Expected: push triggers CI; `checks` + `deploy-staging` green (final DoD evidence).

- [ ] **Step 7: Verify Definition of Done (spec §11)**

- CI green on `main`: `gh run list --limit 1` → completed/success.
- `/api/health` 200 with matching `environment` on all three URLs (re-run Task 9 smokes if any deploy happened since).
- `wrangler.jsonc` contains real IDs matching the naming table: `git grep "database_id" workers/api/wrangler.jsonc` shows no zero-UUID placeholders.
- No secrets in repo (Task 8 Step 9 checks still clean).

---

## Self-Review Record (author)

- **Spec coverage:** §4 layout → Tasks 1-6 · §5 topology → Task 6 wrangler.jsonc · §6 resources (weur, naming, IDs committed) → Task 7 · §7 CI/CD (checks order, staging auto, prod manual+protected, secrets, rollback) → Task 8 + deployment.md · §8 testing (vitest, pool-workers, validation smoke, no prod creds in CI) → Tasks 4/6 · §9 phases 1-8 → Tasks 1-10 (5↔6 swapped, deviation documented in header) · §10 risks → mitigations embedded (frozen-lockfile Task 8, local-only migration validation Task 6/8, ID-commit Task 7, manual-only prod Task 8) · §11 DoD → Task 10 Step 7. Out-of-scope items (§2) untouched by all tasks.
- **Placeholder scan:** `<SUBDOMAIN>` and `<token-from-user>` are runtime-resolved values with explicit resolution steps (Task 8 Step 8 contingency; Task 8 Step 5 user action), not design gaps. All code blocks are complete file contents.
- **Type consistency:** `HealthResponse` identical in Task 3 (definition), Task 6 (route + test), Task 5 (App.tsx consumption). Script names `db:validate`, `deploy:staging`, `deploy:prod`, `build`, `dev` consistent between Task 6 package.json, Task 8 ci.yml, Task 9 commands. Binding names `DB/CACHE/DOCS/ASSETS` consistent across Task 6 (`env.ts`, wrangler.jsonc), Tasks 7, docs. Env vars `ENVIRONMENT` values `"dev"/"staging"/"production"` consistent between wrangler.jsonc and smoke expectations.
