# LearWizAI Step 2 — Design System + i18n Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Step 1 placeholder web app with a locale-aware routed application: design tokens (§8 palette, dark-mode-ready), Inter typography, theme system (system/light/dark), full en/tr i18n foundation with mechanical parity enforcement, React Router v7 locale routing, AppShell (240px sidebar + mobile bottom nav), 17 vendored shadcn/Radix primitives + custom state components with tests, a `/style-guide` showcase, and the Step 1 carry-over CI chores — deployed to staging and production.

**Architecture:** Web-only step (worker untouched except CI smoke). Tokens are CSS custom properties (`:root`/`.dark`) consumed by Tailwind v4 via `@theme inline` (shadcn-compatible). i18next is initialized once with statically imported en/tr JSON namespaces; typed keys via module augmentation; a parity unit test fails CI on en/tr key drift. Routing is `/:locale/*` with the locale param validated by `localeSchema` from `@learwizai/validation`; a `LocaleGate` layout route syncs i18n + `<html lang>` + hreflang. Components are vendored via the shadcn CLI into `src/components/ui/` and owned as our code.

**Tech Stack:** React 19, Vite 7, Tailwind 4, shadcn/ui (Radix) vendored, sonner (toasts), lucide-react (icons), i18next + react-i18next, React Router 7, vitest (jsdom) + @testing-library/react + user-event + jest-dom + vitest-axe, @fontsource-variable/inter, tw-animate-css.

**Spec:** `docs/superpowers/specs/2026-09-11-step2-design-system-i18n-design.md` (binding authority; read it first).

## Global Constraints

Copied from the spec — every task must honor these:

- Palette exact (spec §5.2): light — background `#F8FAFC`, card `#FFFFFF`, muted `#F1F5F9`, foreground `#0F172A`, secondary text `#64748B`, muted-foreground `#94A3B8`, border `#E2E8F0`, primary `#6366F1` (foreground `#FFFFFF`); dark — background `#0F172A`, card `#1E293B`, foreground `#F8FAFC`, secondary/muted-fg `#94A3B8`, border `#334155`, primary `#6366F1` foreground `#FFFFFF`; semantic both modes — success `#10B981`, warning `#F59E0B`, destructive `#EF4444`, info `#3B82F6`.
- Radius scale (§8.6): 6 / 10 / 14 / 18 px + full; `--radius: 0.625rem`; default component radius 10px. Shadows subtle only (§8.7). No gradients by default.
- Inter Variable self-hosted via `@fontsource-variable/inter` (latin + latin-ext, `font-display: swap`); headings 600–700, body 400–500.
- Theme: modes `system | light | dark`; localStorage key `learwiz_theme`; applied as `data-theme` attribute + `.dark` class on `<html>`; no-flash inline pre-paint script in `index.html`; `prefers-reduced-motion` disables non-essential motion globally.
- i18n: namespaces `common`, `nav`, `styleguide` in `src/i18n/locales/{en,tr}/*.json`; `fallbackLng: "en"`; semantic keys only; typed keys via i18next module augmentation; **parity test** (en/tr key trees deep-equal) green in CI.
- No hardcoded user-facing strings (CLAUDE.md §23/§37.3). Documented exceptions: brand name "LearWizAI" and native language names ("English", "Türkçe") are locale-invariant proper nouns.
- Locale resolution order: cookie `learwiz_locale` → localStorage `learwiz_locale` → first `navigator.languages` match in {en,tr} → `"en"`. Route `/:locale` validated with `localeSchema` from `@learwizai/validation`; invalid → redirect to resolved locale.
- Components vendored under `apps/web/src/components/ui/` (shadcn CLI; owned as our code); cva variants; `className` escape hatch on every component; custom state components under `apps/web/src/components/states/`.
- Every task ends green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check` all exit 0 (run `pnpm format` before committing); existing validation/worker suites must stay green.
- One commit per task with the exact message given; push at task end (staging auto-deploys; that is expected and fine).
- Dependency additions limited to: shadcn-managed deps (radix-*, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner), i18next, react-i18next, react-router, @fontsource-variable/inter, tw-animate-css, and the web test stack (vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, vitest-axe). Version contingency: if a range fails to resolve, install the latest compatible and record resolved versions in the commit message body.
- Worker code and `wrangler.jsonc` are NOT touched in this plan (only `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, `apps/web/tsconfig.json` in Task 0).

## File Structure (new/changed files by task)

```text
Task 0: .github/workflows/ci.yml (M), pnpm-workspace.yaml (M), apps/web/tsconfig.json (M)
Task 1: apps/web/vite.config.ts (M: "@" alias), apps/web/tsconfig.json (M: paths+include),
        apps/web/components.json, apps/web/src/lib/utils.ts, apps/web/src/index.css (M: tokens),
        apps/web/index.html (M: no-flash script), apps/web/src/main.tsx (M: font import),
        apps/web/vitest.config.ts, apps/web/test/setup.ts, apps/web/src/theme/ThemeProvider.tsx,
        apps/web/test/theme.test.tsx, apps/web/package.json (M: deps+scripts)
Task 2: apps/web/src/i18n/resources.ts, index.ts, types.d.ts, resolveLocale.ts, localePrefs.ts,
        format.ts, head.ts, locales/{en,tr}/{common,nav,styleguide}.json,
        apps/web/test/{parity.test.ts,resolve-locale.test.ts,format.test.ts},
        apps/web/package.json (M: +i18next, react-i18next, @learwizai/validation)
Task 3: apps/web/src/components/ui/*.tsx (17 vendored via CLI), sonner.tsx adaptation (M)
Task 4: apps/web/src/components/states/{empty-state,loading-state,error-state}.tsx,
        apps/web/test/components-batch1.test.tsx
Task 5: apps/web/test/components-batch2.test.tsx
Task 6: apps/web/src/routes.tsx, src/components/routing/{LocaleGate,LocaleRedirect}.tsx,
        src/pages/{PlaceholderPage,NotFoundPage}.tsx, src/main.tsx (M: RouterProvider),
        DELETE src/App.tsx + src/copy.ts, apps/web/test/routing.test.tsx
Task 7: apps/web/src/components/shell/{AppShell,SidebarNav,BottomNav,MoreSheet,ThemeToggle,LanguageSwitcher,PlanCard}.tsx,
        apps/web/test/shell.test.tsx
Task 8: apps/web/src/pages/StyleGuidePage.tsx
Task 9: (fixes only, if QA sweep finds issues)
Task 10: docs/localization.md, docs/design-system.md, docs/architecture.md (M), README.md (M)
```

---

### Task 0: Carry-over chores (CI smokes, permissions, allowBuilds, vite.config typecheck, bumps)

**Files:**

- Modify: `.github/workflows/ci.yml` (permissions block + 2 smoke steps + conditional action bumps)
- Modify: `pnpm-workspace.yaml` (align build-approval lists + comment)
- Modify: `apps/web/tsconfig.json` (include vite.config.ts)

**Interfaces:**

- Consumes: live staging/prod URLs from Step 1 (`https://learwizai-api-staging.orhankeskinn1.workers.dev`, `https://learwizai-api.orhankeskinn1.workers.dev`).
- Produces: CI deploy jobs that fail on unhealthy deploys (post-deploy smoke assertions); least-privilege workflow token.

- [ ] **Step 1: Add least-privilege permissions to ci.yml**

Insert directly below the `concurrency:` block, at top level:

```yaml
permissions:
  contents: read
```

- [ ] **Step 2: Add post-deploy smoke step to the deploy-staging job** (after its Deploy step)

```yaml
- name: Smoke test staging
  run: |
    sleep 5
    BODY=$(curl -fsS --retry 3 --retry-delay 5 https://learwizai-api-staging.orhankeskinn1.workers.dev/api/health)
    echo "$BODY"
    echo "$BODY" | jq -e '.status == "ok" and .environment == "staging" and .checks.db == "ok"' >/dev/null
```

- [ ] **Step 3: Add post-deploy smoke step to the deploy-production job** (after its Deploy step)

```yaml
- name: Smoke test production
  run: |
    sleep 5
    BODY=$(curl -fsS --retry 3 --retry-delay 5 https://learwizai-api.orhankeskinn1.workers.dev/api/health)
    echo "$BODY"
    echo "$BODY" | jq -e '.status == "ok" and .environment == "production" and .checks.db == "ok"' >/dev/null
```

- [ ] **Step 4: Conditional action bumps**

Check whether `actions/checkout@v5` and `actions/setup-node@v5` tags exist: `gh api repos/actions/checkout/releases/latest --jq .tag_name` (same for setup-node). If a v5 release exists and is not pre-release, bump BOTH jobs' `uses:` lines to v5; otherwise leave v4 and note "bumps skipped: v5 not stable" in the report.

- [ ] **Step 5: Align pnpm-workspace.yaml build approvals**

Make both lists contain the same members and document why both exist:

```yaml
packages:
  - "apps/*"
  - "workers/*"
  - "packages/*"

# pnpm 11 has two build-approval mechanisms: `allowBuilds` (newer, per-package
# true/false decisions written by pnpm tooling) and `onlyBuiltDependencies`
# (legacy whitelist). Keep both lists with identical membership until the
# legacy key is removed in a future pnpm major.
allowBuilds:
  esbuild: true
  sharp: true
  unrs-resolver: true
  workerd: true

onlyBuiltDependencies:
  - esbuild
  - sharp
  - unrs-resolver
  - workerd
```

(If the current file's `allowBuilds` uses a different shape — e.g. a list — keep pnpm's documented map shape shown here; verify with `pnpm install` afterwards. Adjust membership to whatever packages pnpm actually reports as needing build approval in this repo — the four above are the ones observed in Step 1.)

- [ ] **Step 6: Add vite.config.ts to web typecheck**

`apps/web/tsconfig.json` — change `"include": ["src"]` to:

```json
{
  "extends": "@learwizai/config/tsconfig.react.json",
  "include": ["src", "vite.config.ts"],
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 7: Check eslint 10 availability**

Run: `pnpm info typescript-eslint peerDependencies`
If the result lists `eslint: ^10` support (and eslint 10 is published: `pnpm info eslint version` ≥ 10), bump root devDependencies `eslint` + `@eslint/js` to `^10` and run `pnpm install`; otherwise leave at ^9 and note "eslint 10 skipped: typescript-eslint support not declared" in the report.

- [ ] **Step 8: Verify everything green**

Run: `pnpm install` → exit 0 with no ignored-build-script warnings.
Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format` then `pnpm format:check` → all exit 0.

- [ ] **Step 9: Commit + push + watch CI (smoke steps run live)**

```bash
git add .github/workflows/ci.yml pnpm-workspace.yaml apps/web/tsconfig.json pnpm-lock.yaml
git commit -m "chore: CI deploy smokes, least-privilege permissions, allowBuilds alignment, vite.config typecheck"
git push
gh run list --limit 1   # then: gh run watch <run-id> --exit-status
```

Expected: checks ✓, deploy-staging ✓ INCLUDING the new smoke step. If the smoke step fails on a green deploy, capture the curl/jq output and report BLOCKED (do not weaken the assertion).

---

### Task 1: Theme infrastructure — shadcn init, design tokens, Inter, ThemeProvider, web test stack

**Files:**

- Modify: `apps/web/vite.config.ts` (add `@` alias), `apps/web/tsconfig.json` (paths + test includes), `apps/web/src/index.css` (token block), `apps/web/index.html` (no-flash script), `apps/web/src/main.tsx` (font import), `apps/web/package.json` (deps + test script)
- Create: `apps/web/components.json` + `apps/web/src/lib/utils.ts` (via shadcn init or fallback), `apps/web/vitest.config.ts`, `apps/web/test/setup.ts`, `apps/web/src/theme/ThemeProvider.tsx`
- Test: `apps/web/test/theme.test.tsx`

**Interfaces:**

- Consumes: Task 0 green state.
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; `ThemeProvider` + `useTheme(): { mode: ThemeMode; setMode(mode: ThemeMode): void; resolved: "light" | "dark" }` with `type ThemeMode = "system" | "light" | "dark"` from `@/theme/ThemeProvider`; token utilities `bg-background text-foreground bg-primary text-muted-foreground border-border bg-card bg-muted bg-destructive bg-success bg-warning bg-info` etc.; `@` → `apps/web/src` path alias; web `test` script (vitest jsdom) wired into root `pnpm test`.

- [ ] **Step 1: Configure the `@` path alias**

`apps/web/vite.config.ts` — full replacement:

```ts
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
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

`apps/web/tsconfig.json` — full replacement:

```json
{
  "extends": "@learwizai/config/tsconfig.react.json",
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"],
  "compilerOptions": {
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 2: Add the web test stack**

In `apps/web` run:

```powershell
pnpm --filter @learwizai/web add -D vitest jsdom "@testing-library/react" "@testing-library/user-event" "@testing-library/jest-dom" vitest-axe tw-animate-css "@fontsource-variable/inter"
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`.

Contingency: if `vitest-axe` fails to resolve against the installed vitest major, use `jest-axe` + `@types/jest-axe` instead and adapt `test/setup.ts` accordingly (noted in report).

Create `apps/web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
```

Create `apps/web/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; ThemeProvider and tests rely on it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

Note (Windows): `new URL("./src", import.meta.url).pathname` yields `/C:/...` — if the alias fails to resolve in tests on Windows, use `path.resolve(import.meta.dirname, "src")` with `import path from "node:path"` instead (same as vite.config.ts). Verify by running the theme test in Step 8.

- [ ] **Step 3: shadcn init (CLI primary, fallback manual)**

From `apps/web`:

```powershell
pnpm dlx shadcn@latest init -y -b slate
```

This should create `components.json`, `src/lib/utils.ts`, add deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), and rewrite `src/index.css` with its own token block (we replace it in Step 4 — that is expected).

If the CLI prompts interactively or fails non-interactively, create the two artifacts manually:

`apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`apps/web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

and `pnpm --filter @learwizai/web add class-variance-authority clsx tailwind-merge lucide-react`.

- [ ] **Step 4: Replace `apps/web/src/index.css` ENTIRELY with the spec §5 token block**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #94a3b8;
  --accent: #eef2ff;
  --accent-foreground: #0f172a;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --success: #10b981;
  --success-foreground: #ffffff;
  --warning: #f59e0b;
  --warning-foreground: #ffffff;
  --info: #3b82f6;
  --info-foreground: #ffffff;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #6366f1;
}

.dark {
  --background: #0f172a;
  --foreground: #f8fafc;
  --card: #1e293b;
  --card-foreground: #f8fafc;
  --popover: #1e293b;
  --popover-foreground: #f8fafc;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #334155;
  --secondary-foreground: #f8fafc;
  --muted: #334155;
  --muted-foreground: #94a3b8;
  --accent: #334155;
  --accent-foreground: #f8fafc;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --success: #10b981;
  --success-foreground: #ffffff;
  --warning: #f59e0b;
  --warning-foreground: #ffffff;
  --info: #3b82f6;
  --info-foreground: #ffffff;
  --border: #334155;
  --input: #334155;
  --ring: #818cf8;
}

@theme inline {
  --font-sans:
    "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px); /* 6px  — §8.6 */
  --radius-md: var(--radius); /* 10px — §8.6 default */
  --radius-lg: calc(var(--radius) + 4px); /* 14px — §8.6 */
  --radius-xl: calc(var(--radius) + 8px); /* 18px — §8.6 */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}

/* §8.8 + §25: subtle motion only; honor reduced-motion globally. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Inter font import**

In `apps/web/src/main.tsx`, add as the FIRST import line:

```ts
import "@fontsource-variable/inter";
```

(Leave the rest of main.tsx untouched in this task — Task 6 rewrites it for routing.)

- [ ] **Step 6: No-flash theme script in `apps/web/index.html`**

Insert as the last element inside `<head>` (after `<title>`):

```html
<script>
  // Pre-paint theme application — prevents light/dark flash (spec §5.4).
  (function () {
    try {
      var stored = localStorage.getItem("learwiz_theme");
      var mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      var dark =
        mode === "dark" ||
        (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var root = document.documentElement;
      root.setAttribute("data-theme", dark ? "dark" : "light");
      root.classList.toggle("dark", dark);
    } catch (e) {
      /* private mode / storage blocked — default light */
    }
  })();
</script>
```

- [ ] **Step 7: Create `apps/web/src/theme/ThemeProvider.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "learwiz_theme";

interface ThemeContextValue {
  /** User-selected mode. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Mode actually applied to the document (system resolved to light/dark). */
  resolved: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    /* storage unavailable (private mode) */
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Follow OS changes while in system mode.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — mode still applies for this page view */
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode, resolved }), [mode, setMode, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

- [ ] **Step 8: Write theme tests `apps/web/test/theme.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function Probe() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setMode("dark")}>
        to-dark
      </button>
      <button type="button" onClick={() => setMode("system")}>
        to-system
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("defaults to system mode and applies the resolved theme to <html>", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
    // setup.ts mocks matchMedia with matches:false → system resolves to light
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setMode('dark') persists to localStorage and adds .dark", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("learwiz_theme")).toBe("dark");
  });

  it("restores a stored mode on mount", () => {
    localStorage.setItem("learwiz_theme", "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    localStorage.removeItem("learwiz_theme");
    document.documentElement.classList.remove("dark");
  });

  it("throws when useTheme is used outside the provider", () => {
    // Render error is expected; silence the console noise for this case only.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useTheme must be used within ThemeProvider");
    spy.mockRestore();
  });
});
```

- [ ] **Step 9: Run tests (RED not applicable — new infrastructure; verify GREEN)**

Run: `pnpm --filter @learwizai/web test` → 4/4 pass.
Run: `pnpm --filter @learwizai/web build` → exit 0 (proves the token CSS + alias + font compile).
Run (root): `pnpm typecheck`, `pnpm lint` → exit 0. If eslint recommended flags vendored `src/lib/utils.ts` or generated files, fix minimally and record it.

- [ ] **Step 10: Format + commit + push**

```bash
pnpm format
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): design tokens, Inter, ThemeProvider (system/light/dark), shadcn init, web test stack"
git push
```

Expected: CI green (checks + staging deploy + smoke).

---

### Task 2: i18n foundation — react-i18next, en/tr JSON namespaces, typed keys, parity test, locale resolution, Intl utils

**Files:**

- Create: `apps/web/src/i18n/resources.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/types.d.ts`, `apps/web/src/i18n/resolveLocale.ts`, `apps/web/src/i18n/localePrefs.ts`, `apps/web/src/i18n/format.ts`, `apps/web/src/i18n/head.ts`
- Create: `apps/web/src/i18n/locales/en/{common,nav,styleguide}.json` and `.../tr/{common,nav,styleguide}.json`
- Modify: `apps/web/package.json` (deps)
- Test: `apps/web/test/parity.test.ts`, `apps/web/test/resolve-locale.test.ts`, `apps/web/test/format.test.ts`

**Interfaces:**

- Consumes: `localeSchema` + `Locale` (from `@learwizai/validation` / `@learwizai/types`), web test stack (Task 1).
- Produces (used by Tasks 4–8): `SUPPORTED_LOCALES: readonly ["en","tr"]` and `resources` from `@/i18n/resources`; default-exported configured `i18n` instance + `getActiveLocale(): Locale` from `@/i18n`; `resolveLocale(sources: LocaleSources): Locale` + `interface LocaleSources { cookieValue?: string | null; storedValue?: string | null; browserLanguages?: readonly string[] }` from `@/i18n/resolveLocale`; `readLocaleSources(): LocaleSources`, `setLocalePreference(locale: Locale): void`, `LOCALE_COOKIE = "learwiz_locale"` from `@/i18n/localePrefs`; `formatDate/formatNumber/formatRelativeTime` from `@/i18n/format`; `syncHreflang(locale: Locale): void` from `@/i18n/head`.

- [ ] **Step 1: Install deps**

```powershell
pnpm --filter @learwizai/web add i18next react-i18next
pnpm --filter @learwizai/web add "@learwizai/validation@workspace:*"
```

Expected majors: i18next ^25, react-i18next ^15 or ^16 (must support React 19). Record resolved versions in the report; if react-i18next lags React 19 support, STOP and report BLOCKED with the peer-error text.

- [ ] **Step 2: Create the six JSON files with EXACTLY this content**

`apps/web/src/i18n/locales/en/common.json`:

```json
{
  "actions": {
    "retry": "Try again",
    "back": "Go back",
    "close": "Close",
    "save": "Save",
    "cancel": "Cancel",
    "continue": "Continue"
  },
  "states": {
    "loading": "Loading…",
    "error": "Something went wrong",
    "empty": "Nothing here yet"
  },
  "theme": {
    "label": "Theme",
    "system": "System",
    "light": "Light",
    "dark": "Dark"
  },
  "language": {
    "label": "Language",
    "switchAria": "Switch language, currently {{language}}"
  },
  "plan": {
    "currentPlan": "Plan",
    "free": "Free",
    "usageUnavailable": "Usage details arrive with your account"
  },
  "errors": {
    "unexpected": "An unexpected error occurred. Please try again."
  },
  "aria": {
    "mainNavigation": "Main navigation",
    "mobileNavigation": "Mobile navigation",
    "moreMenu": "More options",
    "skipToContent": "Skip to content"
  }
}
```

`apps/web/src/i18n/locales/tr/common.json`:

```json
{
  "actions": {
    "retry": "Tekrar dene",
    "back": "Geri dön",
    "close": "Kapat",
    "save": "Kaydet",
    "cancel": "Vazgeç",
    "continue": "Devam et"
  },
  "states": {
    "loading": "Yükleniyor…",
    "error": "Bir şeyler ters gitti",
    "empty": "Henüz burada bir şey yok"
  },
  "theme": {
    "label": "Tema",
    "system": "Sistem",
    "light": "Açık",
    "dark": "Koyu"
  },
  "language": {
    "label": "Dil",
    "switchAria": "Dili değiştir, şu an {{language}}"
  },
  "plan": {
    "currentPlan": "Plan",
    "free": "Ücretsiz",
    "usageUnavailable": "Kullanım detayları hesabınızla birlikte gelir"
  },
  "errors": {
    "unexpected": "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."
  },
  "aria": {
    "mainNavigation": "Ana gezinme",
    "mobileNavigation": "Mobil gezinme",
    "moreMenu": "Diğer seçenekler",
    "skipToContent": "İçeriğe geç"
  }
}
```

`apps/web/src/i18n/locales/en/nav.json`:

```json
{
  "brand": "LearWizAI",
  "items": {
    "dashboard": "Dashboard",
    "tutor": "AI Tutor",
    "learn": "Learn",
    "practice": "Practice",
    "quizzes": "Quizzes",
    "documents": "Documents",
    "progress": "Progress",
    "settings": "Settings"
  },
  "mobile": {
    "home": "Home",
    "more": "More"
  },
  "placeholders": {
    "dashboard": {
      "title": "Your dashboard is coming",
      "description": "Continue-learning, recommendations and progress arrive in a later step."
    },
    "tutor": {
      "title": "AI Tutor is coming",
      "description": "Explain, simplify, quiz and practice with your AI teacher — available in a later step."
    },
    "learn": {
      "title": "Learn Mode is coming",
      "description": "Structured lessons: concept, intuition, example, common mistakes, mini exercise."
    },
    "practice": {
      "title": "Practice Mode is coming",
      "description": "Topic questions with instant feedback and explanations."
    },
    "quizzes": {
      "title": "Quiz Generator is coming",
      "description": "Generate quizzes by topic, difficulty and question type."
    },
    "documents": {
      "title": "Documents are coming",
      "description": "Upload PDFs, chat with them, get summaries and quizzes."
    },
    "progress": {
      "title": "Progress tracking is coming",
      "description": "Topic mastery, weak areas and recommended review."
    },
    "settings": {
      "title": "Settings are coming",
      "description": "Account, language, theme and notification preferences."
    }
  },
  "notFound": {
    "title": "Page not found",
    "description": "The page you are looking for does not exist or has moved."
  }
}
```

`apps/web/src/i18n/locales/tr/nav.json`:

```json
{
  "brand": "LearWizAI",
  "items": {
    "dashboard": "Panel",
    "tutor": "AI Özel Ders",
    "learn": "Öğren",
    "practice": "Alıştırma",
    "quizzes": "Testler",
    "documents": "Belgeler",
    "progress": "Gelişim",
    "settings": "Ayarlar"
  },
  "mobile": {
    "home": "Ana Sayfa",
    "more": "Diğer"
  },
  "placeholders": {
    "dashboard": {
      "title": "Panelin çok yakında",
      "description": "Öğrenmeye devam, öneriler ve ilerleme bilgisi sonraki adımda geliyor."
    },
    "tutor": {
      "title": "AI Özel Ders çok yakında",
      "description": "AI öğretmeninle açıklat, sadeleştir, test çöz ve pratik yap — sonraki adımda."
    },
    "learn": {
      "title": "Öğrenme Modu çok yakında",
      "description": "Yapılandırılmış dersler: kavram, sezgi, örnek, yaygın hatalar, mini alıştırma."
    },
    "practice": {
      "title": "Alıştırma Modu çok yakında",
      "description": "Anında geri bildirimli ve açıklamalı konu soruları."
    },
    "quizzes": {
      "title": "Test Oluşturucu çok yakında",
      "description": "Konu, zorluk ve soru tipine göre testler üret."
    },
    "documents": {
      "title": "Belgeler çok yakında",
      "description": "PDF yükle, belgeyle sohbet et, özet ve test al."
    },
    "progress": {
      "title": "Gelişim takibi çok yakında",
      "description": "Konu hakimiyeti, zayıf alanlar ve önerilen tekrarlar."
    },
    "settings": {
      "title": "Ayarlar çok yakında",
      "description": "Hesap, dil, tema ve bildirim tercihleri."
    }
  },
  "notFound": {
    "title": "Sayfa bulunamadı",
    "description": "Aradığın sayfa mevcut değil veya taşınmış olabilir."
  }
}
```

`apps/web/src/i18n/locales/en/styleguide.json`:

```json
{
  "title": "LearWizAI Style Guide",
  "subtitle": "Design tokens, components and patterns — the Step 2 foundation.",
  "sections": {
    "tokens": "Color tokens",
    "typography": "Typography",
    "radius": "Radius & shadows",
    "buttons": "Buttons",
    "forms": "Inputs & selects",
    "cards": "Cards & badges",
    "overlays": "Dialog, sheet & dropdown",
    "tabs": "Tabs",
    "feedback": "Toast, progress & skeleton",
    "avatars": "Avatars",
    "tooltips": "Tooltips",
    "states": "Empty / Loading / Error states",
    "theme": "Theme"
  },
  "demo": {
    "themeNote": "Theme preference persists and applies instantly (system / light / dark).",
    "toast": "This is a toast notification",
    "dialogTitle": "Example dialog",
    "dialogDescription": "Dialog content lives here.",
    "sheetTitle": "Example sheet",
    "sheetDescription": "Sheet content lives here.",
    "menu": "Menu",
    "menuItem": "Menu item",
    "tooltip": "Tooltip text",
    "tabA": "Tab A",
    "tabB": "Tab B",
    "sampleTitle": "Sample card",
    "sampleDescription": "Card description text.",
    "selectPlaceholder": "Select an option",
    "optionA": "Option A",
    "optionB": "Option B",
    "inputLabel": "Email",
    "inputPlaceholder": "you@example.com",
    "textareaPlaceholder": "Write something…",
    "increaseProgress": "Increase progress",
    "emptyTitle": "Nothing here yet",
    "emptyDescription": "This is how an empty surface looks.",
    "retryFired": "Retry was fired"
  }
}
```

`apps/web/src/i18n/locales/tr/styleguide.json`:

```json
{
  "title": "LearWizAI Stil Rehberi",
  "subtitle": "Design token'lar, bileşenler ve kalıplar — Step 2 temeli.",
  "sections": {
    "tokens": "Renk token'ları",
    "typography": "Tipografi",
    "radius": "Radius ve gölgeler",
    "buttons": "Butonlar",
    "forms": "Input ve select'ler",
    "cards": "Kartlar ve rozetler",
    "overlays": "Dialog, sheet ve dropdown",
    "tabs": "Sekmeler",
    "feedback": "Toast, progress ve skeleton",
    "avatars": "Avatarlar",
    "tooltips": "Tooltip'ler",
    "states": "Boş / Yükleniyor / Hata durumları",
    "theme": "Tema"
  },
  "demo": {
    "themeNote": "Tema tercihi kalıcıdır ve anında uygulanır (sistem / açık / koyu).",
    "toast": "Bu bir toast bildirimidir",
    "dialogTitle": "Örnek dialog",
    "dialogDescription": "Dialog içeriği burada yer alır.",
    "sheetTitle": "Örnek sheet",
    "sheetDescription": "Sheet içeriği burada yer alır.",
    "menu": "Menü",
    "menuItem": "Menü öğesi",
    "tooltip": "Tooltip metni",
    "tabA": "Sekme A",
    "tabB": "Sekme B",
    "sampleTitle": "Örnek kart",
    "sampleDescription": "Kart açıklama metni.",
    "selectPlaceholder": "Bir seçenek seçin",
    "optionA": "Seçenek A",
    "optionB": "Seçenek B",
    "inputLabel": "E-posta",
    "inputPlaceholder": "siz@ornek.com",
    "textareaPlaceholder": "Bir şeyler yazın…",
    "increaseProgress": "İlerlemeyi artır",
    "emptyTitle": "Henüz burada bir şey yok",
    "emptyDescription": "Boş bir yüzey böyle görünür.",
    "retryFired": "Tekrar dene tetiklendi"
  }
}
```

- [ ] **Step 3: Create `apps/web/src/i18n/resources.ts`**

```ts
import type enCommon from "./locales/en/common.json";
import type enNav from "./locales/en/nav.json";
import type enStyleguide from "./locales/en/styleguide.json";
import enCommonJson from "./locales/en/common.json";
import enNavJson from "./locales/en/nav.json";
import enStyleguideJson from "./locales/en/styleguide.json";
import trCommonJson from "./locales/tr/common.json";
import trNavJson from "./locales/tr/nav.json";
import trStyleguideJson from "./locales/tr/styleguide.json";

/** Locale-independent list of supported locales (CLAUDE.md §6). */
export const SUPPORTED_LOCALES = ["en", "tr"] as const;

/** Namespace names shipped in Step 2; later steps add their own (spec §6.1). */
export const NAMESPACES = ["common", "nav", "styleguide"] as const;

export const resources = {
  en: { common: enCommonJson, nav: enNavJson, styleguide: enStyleguideJson },
  tr: { common: trCommonJson, nav: trNavJson, styleguide: trStyleguideJson },
} as const;

/** English resource shape — the source of truth for typed keys. */
export type EnResources = {
  common: typeof enCommon;
  nav: typeof enNav;
  styleguide: typeof enStyleguide;
};
```

- [ ] **Step 4: Create `apps/web/src/i18n/index.ts`**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "@learwizai/types";
import { NAMESPACES, resources } from "./resources";

// lng is set per-route by LocaleGate (Task 6); "en" is only the boot default.
void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: [...NAMESPACES],
  interpolation: { escapeValue: false }, // React already escapes
});

/** Active UI locale, normalized to the supported set (§6.4 helper for API calls). */
export function getActiveLocale(): Locale {
  return i18n.language === "tr" ? "tr" : "en";
}

export default i18n;
```

- [ ] **Step 5: Create `apps/web/src/i18n/types.d.ts`** (typed keys — unknown keys fail typecheck)

```ts
import "i18next";
import type { EnResources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: EnResources;
    returnNull: false;
  }
}
```

- [ ] **Step 6: Create `apps/web/src/i18n/resolveLocale.ts`** (pure — unit tested)

```ts
import type { Locale } from "@learwizai/types";
import { localeSchema } from "@learwizai/validation";

/** Where locale hints come from; kept injectable so resolution is unit-testable. */
export interface LocaleSources {
  /** Value of the `learwiz_locale` cookie, if any. */
  cookieValue?: string | null;
  /** Value of the `learwiz_locale` localStorage key, if any. */
  storedValue?: string | null;
  /** `navigator.languages` (or `[navigator.language]`). */
  browserLanguages?: readonly string[];
}

/**
 * Locale resolution precedence (CLAUDE.md §6.3, pre-auth slice):
 * explicit guest selection (cookie, then storage) → browser language → "en".
 * The authenticated-user tier is added by the auth step (spec §6.3).
 */
export function resolveLocale(sources: LocaleSources): Locale {
  for (const candidate of [sources.cookieValue, sources.storedValue]) {
    if (!candidate) continue;
    const parsed = localeSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  for (const language of sources.browserLanguages ?? []) {
    const base = language.toLowerCase().split("-")[0];
    const parsed = localeSchema.safeParse(base);
    if (parsed.success) return parsed.data;
  }
  return "en";
}
```

- [ ] **Step 7: Create `apps/web/src/i18n/localePrefs.ts`** (impure wrapper — cookie is authoritative, storage mirrors)

```ts
import type { Locale } from "@learwizai/types";
import { type LocaleSources, resolveLocale } from "./resolveLocale";

export const LOCALE_COOKIE = "learwiz_locale";
const STORAGE_KEY = "learwiz_locale";
const ONE_YEAR_SECONDS = 31_536_000;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function readStorage(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null; // storage blocked
  }
}

/** Gather real-browser inputs for resolveLocale(). */
export function readLocaleSources(): LocaleSources {
  return {
    cookieValue: readCookie(LOCALE_COOKIE),
    storedValue: readStorage(STORAGE_KEY),
    browserLanguages:
      typeof navigator === "undefined"
        ? []
        : (navigator.languages ?? [navigator.language]).filter((l): l is string => Boolean(l)),
  };
}

/** Persist an explicit guest locale choice (cookie authoritative + storage mirror). */
export function setLocalePreference(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR_SECONDS};SameSite=Lax`;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // cookie still records the choice
  }
}

/** Convenience: resolve from the live browser environment. */
export function resolveBrowserLocale(): Locale {
  return resolveLocale(readLocaleSources());
}
```

- [ ] **Step 8: Create `apps/web/src/i18n/format.ts`** (§6.1 Intl wrappers)

```ts
import i18n from "./index";

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", ...options }).format(date);
}

export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18n.language, { timeStyle: "short", ...options }).format(date);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(i18n.language, options).format(value);
}

export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(value, unit);
}
```

- [ ] **Step 9: Create `apps/web/src/i18n/head.ts`** (hreflang/canonical management)

```ts
import type { Locale } from "@learwizai/types";
import { SUPPORTED_LOCALES } from "./resources";

const MARKER = "data-i18n-head";

function withLocale(pathname: string, locale: Locale): string {
  const rest = pathname.replace(/^\/(?:en|tr)(?=\/|$)/, "");
  return `/${locale}${rest}`;
}

/**
 * Replace hreflang alternates + canonical to match the active locale/route.
 * Baseline SEO for the SPA route model (§31); prerendering lands later.
 */
export function syncHreflang(locale: Locale): void {
  const head = document.head;
  head.querySelectorAll(`link[${MARKER}]`).forEach((el) => el.remove());

  const { origin, pathname, search } = window.location;
  for (const target of SUPPORTED_LOCALES) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = target;
    link.href = `${origin}${withLocale(pathname, target)}${search}`;
    link.setAttribute(MARKER, "");
    head.appendChild(link);
  }

  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = `${origin}${withLocale(pathname, locale)}${search}`;
  canonical.setAttribute(MARKER, "");
  head.appendChild(canonical);
}
```

- [ ] **Step 10: Write the parity test `apps/web/test/parity.test.ts`** (TDD anchor of §6.1)

```ts
import { describe, expect, it } from "vitest";
import { NAMESPACES, resources } from "@/i18n/resources";

function collectKeys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

function collectLeafValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node !== "object" || node === null) return [];
  return Object.values(node as Record<string, unknown>).flatMap(collectLeafValues);
}

describe("en/tr translation parity (CLAUDE.md §6.1)", () => {
  it.each([...NAMESPACES])("namespace %s has identical key trees in en and tr", (ns) => {
    const enKeys = collectKeys(resources.en[ns]).sort();
    const trKeys = collectKeys(resources.tr[ns]).sort();
    const missingInTr = enKeys.filter((k) => !trKeys.includes(k));
    const extraInTr = trKeys.filter((k) => !enKeys.includes(k));
    expect({ missingInTr, extraInTr }).toEqual({ missingInTr: [], extraInTr: [] });
  });

  it("has no empty string values in any locale", () => {
    for (const locale of ["en", "tr"] as const) {
      for (const ns of NAMESPACES) {
        const leaves = collectLeafValues(resources[locale][ns]);
        expect(leaves.every((v) => v.trim().length > 0)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 11: Write resolution tests `apps/web/test/resolve-locale.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { resolveLocale } from "@/i18n/resolveLocale";

describe("resolveLocale (§6.3 precedence)", () => {
  it("prefers an explicit cookie choice", () => {
    expect(
      resolveLocale({ cookieValue: "tr", storedValue: "en", browserLanguages: ["en-US"] }),
    ).toBe("tr");
  });

  it("falls back to stored choice when no cookie", () => {
    expect(resolveLocale({ storedValue: "tr", browserLanguages: ["en-US"] })).toBe("tr");
  });

  it("falls back to browser language with region subtags", () => {
    expect(resolveLocale({ browserLanguages: ["de-DE", "tr-TR", "en-US"] })).toBe("tr");
    expect(resolveLocale({ browserLanguages: ["en-GB"] })).toBe("en");
  });

  it("ignores invalid cookie/storage values", () => {
    expect(resolveLocale({ cookieValue: "de", storedValue: "fr", browserLanguages: [] })).toBe(
      "en",
    );
  });

  it("defaults to en with no signals", () => {
    expect(resolveLocale({})).toBe("en");
  });
});
```

- [ ] **Step 12: Write format tests `apps/web/test/format.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import i18n, { getActiveLocale } from "@/i18n";
import { formatDate, formatNumber, formatRelativeTime } from "@/i18n/format";

describe("Intl format utils (§6.1)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("formats numbers per locale (decimal separators differ)", async () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    await i18n.changeLanguage("tr");
    // Turkish locale uses comma decimal / period thousands separators
    expect(formatNumber(1234.5)).toMatch(/1[.,]234/);
  });

  it("formats dates in both locales without throwing and produces different output", async () => {
    const date = new Date(2026, 0, 15);
    const en = formatDate(date);
    await i18n.changeLanguage("tr");
    const tr = formatDate(date);
    expect(en.length).toBeGreaterThan(0);
    expect(tr).toMatch(/2026|Oca/);
    expect(en).not.toBe(tr);
  });

  it("formats relative time with numeric auto", async () => {
    expect(formatRelativeTime(-1, "day")).toMatch(/yesterday/i);
    await i18n.changeLanguage("tr");
    expect(formatRelativeTime(-1, "day")).toMatch(/dün/i);
  });

  it("getActiveLocale tracks the i18n language", async () => {
    expect(getActiveLocale()).toBe("en");
    await i18n.changeLanguage("tr");
    expect(getActiveLocale()).toBe("tr");
  });
});
```

Note: importing `@/i18n` runs `init` — fine under jsdom. If ICU output for tr differs slightly by Node version, keep assertions to the robust fragments shown.

- [ ] **Step 13: Run the suite**

Run: `pnpm --filter @learwizai/web test` → all theme + parity + resolution + format tests pass.
Run: `pnpm --filter @learwizai/web typecheck` → exit 0 (proves typed-keys augmentation compiles).
Negative control (must fail, then revert): temporarily add key `"__probe": "x"` to `en/common.json` only → `pnpm --filter @learwizai/web test` MUST fail on parity → revert the probe, tests green again. Record both outputs.

- [ ] **Step 14: Format + commit + push**

```bash
pnpm format
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): i18n foundation — en/tr namespaces, typed keys, parity test, locale resolution, Intl utils"
git push
```

---

### Task 3: Vendor the shadcn component set

**Files:**

- Create (via CLI): `apps/web/src/components/ui/{button,input,textarea,select,label,card,badge,separator,dialog,sheet,tabs,dropdown-menu,tooltip,progress,skeleton,avatar,sonner}.tsx`
- Modify: `apps/web/src/components/ui/sonner.tsx` (swap next-themes for our ThemeProvider), `apps/web/package.json` (CLI-added deps)

**Interfaces:**

- Consumes: `cn` from `@/lib/utils`, token CSS (Task 1), `components.json` (Task 1).
- Produces: all 17 primitives importable as `@/components/ui/<name>` with shadcn's standard export shapes (e.g. `Button`, `buttonVariants`; `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`; `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter`; `Badge, badgeVariants`; `Tabs, TabsList, TabsTrigger, TabsContent`; `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxes...` as vendored; `Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose`; `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`; `Progress`; `Skeleton`; `Avatar, AvatarImage, AvatarFallback`; `Input`; `Textarea`; `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`; `Label`; `Separator`; `Toaster, toast` (sonner)). Badge gains custom semantic variants (below).

- [ ] **Step 1: Add all components via CLI**

From `apps/web`:

```powershell
pnpm dlx shadcn@latest add button input textarea select label card badge separator dialog sheet tabs dropdown-menu tooltip progress skeleton avatar sonner -y -o
```

If the CLI fails on any single component, re-run for the remaining ones; if it fails entirely, report BLOCKED with the error (do not hand-write Radix compositions).

- [ ] **Step 2: Fix the sonner next-themes coupling**

The vendored `sonner.tsx` imports `useTheme` from `next-themes`. Replace that file's content with:

```tsx
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/theme/ThemeProvider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
```

If the vendored file also exports `toast` (re-export from sonner), keep that export line: `export { toast } from "sonner";`. Do NOT add next-themes as a dependency.

- [ ] **Step 3: Extend Badge with semantic variants**

In `apps/web/src/components/ui/badge.tsx`, extend the `badgeVariants` cva `variants.variant` map with four additional entries (keep the existing ones verbatim):

```ts
        success:
          "border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90",
        warning:
          "border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90",
        error:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        info: "border-transparent bg-info text-info-foreground [a&]:hover:bg-info/90",
```

(Insert inside the existing `variant: { ... }` object, matching the file's formatting; `[a&]:hover` guards may already read `a:hover` depending on CLI version — mirror whatever pattern the vendored variants use.)

- [ ] **Step 4: Verify compile + no next-themes**

Run: `pnpm install` (new deps from CLI), `pnpm --filter @learwizai/web typecheck` → exit 0; `pnpm --filter @learwizai/web build` → exit 0; `pnpm lint` → exit 0.
Run: `git grep -n "next-themes" -- apps/web` → NO matches.
Run: `git grep -n "from \"next" -- apps/web/src/components/ui` → NO matches.
If eslint flags vendored files, fix by disabling the specific rule for `apps/web/src/components/ui/**` in the root `eslint.config.js` (targeted rule off, NOT a directory-wide ignore) and record which rule.

- [ ] **Step 5: Format + commit + push**

```bash
pnpm format
git add apps/web pnpm-lock.yaml eslint.config.js
git commit -m "feat(web): vendor shadcn component set (17 primitives) with token-aligned badge variants"
git push
```

---

### Task 4: Custom state components + component test suite batch 1

**Files:**

- Create: `apps/web/src/components/states/empty-state.tsx`, `loading-state.tsx`, `error-state.tsx`
- Test: `apps/web/test/components-batch1.test.tsx`

**Interfaces:**

- Consumes: vendored `Button` (Task 3), i18n `common` namespace (Task 2), test stack (Task 1).
- Produces: `EmptyState({ title: string; description?: string; icon?: ReactNode; action?: ReactNode; className?: string })`, `LoadingState({ label?: string; className?: string })` (role="status", default label `common:states.loading`), `ErrorState({ message?: string; onRetry?: () => void; className?: string })` (role="alert", default message `common:errors.unexpected`, retry button `common:actions.retry`) — used by pages (Task 6) and the showcase (Task 8).

- [ ] **Step 1: Create `empty-state.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Localized empty-state surface (CLAUDE.md §24/§29). Callers pass translated strings. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Create `loading-state.tsx`**

```tsx
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Override for the default localized "Loading…" label. */
  label?: string;
  className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-2 p-10", className)}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label ?? t("states.loading")}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `error-state.tsx`**

```tsx
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Override for the default localized unexpected-error message. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-3 p-10 text-center", className)}
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{message ?? t("errors.unexpected")}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Write test batch 1 `apps/web/test/components-batch1.test.tsx`**

```tsx
import "@/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

describe("Button", () => {
  it("fires onClick and respects disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Save</Button>
        <Button disabled onClick={onClick}>
          No
        </Button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the primary token classes by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toMatch(/bg-primary/);
  });
});

describe("Input", () => {
  it("accepts typed value", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="email" type="email" />);
    const input = screen.getByLabelText("email");
    await user.type(input, "a@b.co");
    expect(input).toHaveValue("a@b.co");
  });
});

describe("Card + Badge", () => {
  it("renders header/content and semantic badge variants", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title here</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="success">ok</Badge>
          <Badge variant="warning">warn</Badge>
          <Badge variant="error">err</Badge>
          <Badge variant="info">info</Badge>
        </CardContent>
      </Card>,
    );
    expect(screen.getByText("Title here")).toBeInTheDocument();
    expect(screen.getByText("ok").className).toMatch(/bg-success/);
    expect(screen.getByText("warn").className).toMatch(/bg-warning/);
    expect(screen.getByText("err").className).toMatch(/bg-destructive/);
    expect(screen.getByText("info").className).toMatch(/bg-info/);
  });
});

describe("State components", () => {
  it("EmptyState renders title, description and action", () => {
    render(
      <EmptyState
        title="Nothing yet"
        description="Check back later."
        action={<Button>Act</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
    expect(screen.getByText("Check back later.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("LoadingState has role=status and localized default label (en)", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("ErrorState has role=alert, localized default message, working retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("state components have no axe violations", async () => {
    const { container } = render(
      <>
        <EmptyState title="Empty" />
        <LoadingState />
        <ErrorState />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

If `Badge` variant names from Task 3 Step 3 differ in the vendored cva output (e.g. class `bg-success` merged by twMerge), assert on the rendered `className` containing the token utility as written; adjust ONLY the assertion string, never weaken it to a snapshot.

- [ ] **Step 5: Run tests + gates**

Run: `pnpm --filter @learwizai/web test` → theme + i18n + batch1 all pass.
Run: `pnpm typecheck`, `pnpm lint`, `pnpm build` → exit 0.

- [ ] **Step 6: Format + commit + push**

```bash
pnpm format
git add apps/web
git commit -m "feat(web): EmptyState/LoadingState/ErrorState + component test batch 1"
git push
```

---

### Task 5: Component test suite batch 2 (overlays & feedback)

**Files:**

- Modify: `apps/web/test/setup.ts` (Radix/jsdom DOM-API shims)
- Test: `apps/web/test/components-batch2.test.tsx`

**Interfaces:**

- Consumes: vendored dialog/sheet/tabs/dropdown-menu/tooltip/progress/skeleton/avatar/sonner (Task 3), ThemeProvider (Task 1 — sonner's Toaster requires it).
- Produces: proof that overlay/feedback primitives work under jsdom; setup shims later Radix-based code relies on.

- [ ] **Step 1: Extend `apps/web/test/setup.ts`** — append (keep existing content):

```ts
// Radix UI relies on DOM APIs jsdom does not implement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const htmlProto = window.HTMLElement.prototype as HTMLElement & {
  scrollIntoView?: () => void;
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
};
htmlProto.scrollIntoView ??= function scrollIntoView() {};
htmlProto.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
htmlProto.setPointerCapture ??= function setPointerCapture() {};
htmlProto.releasePointerCapture ??= function releasePointerCapture() {};
```

- [ ] **Step 2: Write `apps/web/test/components-batch2.test.tsx`**

```tsx
import "@/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

describe("Dialog", () => {
  it("opens on trigger, shows title, closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Are you sure?</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("switches panels on trigger click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Panel A")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(await screen.findByText("Panel B")).toBeVisible();
  });
});

describe("DropdownMenu", () => {
  it("opens and selects via keyboard", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First</DropdownMenuItem>
          <DropdownMenuItem>Second</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "First" })).toBeInTheDocument();
  });
});

describe("Tooltip", () => {
  it("shows content on trigger focus", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Helper text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    expect(await screen.findByText("Helper text")).toBeInTheDocument();
  });
});

describe("Feedback primitives", () => {
  it("Progress exposes its value to assistive tech", () => {
    render(<Progress value={42} aria-label="upload" />);
    expect(screen.getByRole("progressbar", { name: "upload" })).toBeInTheDocument();
  });

  it("Skeleton and Avatar render", () => {
    render(
      <>
        <Skeleton data-testid="skeleton" className="h-4 w-24" />
        <Avatar>
          <AvatarFallback>OK</AvatarFallback>
        </Avatar>
      </>,
    );
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("sonner Toaster shows a toast fired via toast()", async () => {
    render(
      <ThemeProvider>
        <Toaster />
        <Button onClick={() => toast("Saved successfully")}>Fire</Button>
      </ThemeProvider>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Fire" }));
    expect(await screen.findByText("Saved successfully")).toBeInTheDocument();
  });
});

describe("Overlay a11y", () => {
  it("dialog markup has no axe violations while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
```

Vendored-export contingency: if the CLI vendored slightly different export names (e.g. `SheetDescription` instead of `DialogDescription` inside dialog.tsx), adjust ONLY the import/JSX names to match the vendored files — never change behavior under test.

- [ ] **Step 3: Run + gates**

Run: `pnpm --filter @learwizai/web test` → everything green (theme + i18n + batch1 + batch2).
Run: `pnpm typecheck`, `pnpm lint`, `pnpm build` → exit 0.

- [ ] **Step 4: Format + commit + push**

```bash
pnpm format
git add apps/web
git commit -m "test(web): component suite batch 2 — dialogs, tabs, dropdown, tooltip, toast, a11y"
git push
```

---

### Task 6: Routing — React Router v7, LocaleGate, placeholder pages, 404, minimal shell/style-guide stubs

**Files:**

- Create: `apps/web/src/routes.tsx`, `apps/web/src/components/routing/LocaleGate.tsx`, `apps/web/src/components/routing/LocaleRedirect.tsx`, `apps/web/src/pages/PlaceholderPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`, `apps/web/src/pages/StyleGuidePage.tsx` (stub — Task 8 expands), `apps/web/src/components/shell/AppShell.tsx` (minimal — Task 7 replaces internals)
- Modify: `apps/web/src/main.tsx` (RouterProvider), `apps/web/package.json` (+react-router)
- Delete: `apps/web/src/App.tsx`, `apps/web/src/copy.ts`
- Test: `apps/web/test/routing.test.tsx`

**Interfaces:**

- Consumes: i18n (Task 2: `resolveBrowserLocale`, `syncHreflang`, i18n instance), `localeSchema`, EmptyState (Task 4).
- Produces: `routes: RouteObject[]` from `@/routes` (consumed by main.tsx + tests); `PLACEHOLDER_SECTIONS` + `type PlaceholderSection = "dashboard" | "tutor" | "learn" | "practice" | "quizzes" | "documents" | "progress" | "settings"`; route surface `/`, `/:locale` (shell children: index + 8 sections), `/:locale/style-guide`, catch-all 404; `AppShell` component name/location fixed (Task 7 fills it); `StyleGuidePage` name/location fixed (Task 8 fills it).

- [ ] **Step 1: Install react-router**

```powershell
pnpm --filter @learwizai/web add react-router
```

Expected major: ^7. Record resolved version.

- [ ] **Step 2: Create `LocaleRedirect.tsx`**

```tsx
import { Navigate } from "react-router";
import { resolveBrowserLocale } from "@/i18n/localePrefs";

/** "/" → "/{resolved}" per CLAUDE.md §6.3 (guest slice). */
export function LocaleRedirect() {
  return <Navigate to={`/${resolveBrowserLocale()}`} replace />;
}
```

- [ ] **Step 3: Create `LocaleGate.tsx`**

```tsx
import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router";
import type { Locale } from "@learwizai/types";
import { localeSchema } from "@learwizai/validation";
import i18n from "@/i18n";
import { syncHreflang } from "@/i18n/head";
import { resolveBrowserLocale } from "@/i18n/localePrefs";

/**
 * Validates :locale against the shared contract schema and syncs the active
 * locale into i18next, <html lang> and hreflang/canonical head links.
 */
export function LocaleGate() {
  const { locale } = useParams();
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) {
    return <Navigate to={`/${resolveBrowserLocale()}`} replace />;
  }
  return <LocaleSync locale={parsed.data} />;
}

function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
    syncHreflang(locale);
  }, [locale]);
  return <Outlet />;
}
```

- [ ] **Step 4: Create `PlaceholderPage.tsx`** (explicit key maps keep typed keys literal)

```tsx
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/states/empty-state";

export const PLACEHOLDER_SECTIONS = [
  "dashboard",
  "tutor",
  "learn",
  "practice",
  "quizzes",
  "documents",
  "progress",
  "settings",
] as const;

export type PlaceholderSection = (typeof PLACEHOLDER_SECTIONS)[number];

const TITLE_KEYS = {
  dashboard: "placeholders.dashboard.title",
  tutor: "placeholders.tutor.title",
  learn: "placeholders.learn.title",
  practice: "placeholders.practice.title",
  quizzes: "placeholders.quizzes.title",
  documents: "placeholders.documents.title",
  progress: "placeholders.progress.title",
  settings: "placeholders.settings.title",
} as const satisfies Record<PlaceholderSection, string>;

const DESCRIPTION_KEYS = {
  dashboard: "placeholders.dashboard.description",
  tutor: "placeholders.tutor.description",
  learn: "placeholders.learn.description",
  practice: "placeholders.practice.description",
  quizzes: "placeholders.quizzes.description",
  documents: "placeholders.documents.description",
  progress: "placeholders.progress.description",
  settings: "placeholders.settings.description",
} as const satisfies Record<PlaceholderSection, string>;

/** Localized "arrives in a later step" surface for each nav destination (§29). */
export function PlaceholderPage({ section }: { section: PlaceholderSection }) {
  const { t } = useTranslation("nav");
  return <EmptyState title={t(TITLE_KEYS[section])} description={t(DESCRIPTION_KEYS[section])} />;
}
```

- [ ] **Step 5: Create `NotFoundPage.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/states/empty-state";

export function NotFoundPage() {
  const { t } = useTranslation("nav");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <EmptyState title={t("notFound.title")} description={t("notFound.description")} />
    </main>
  );
}
```

- [ ] **Step 6: Create the minimal `AppShell.tsx`** (Task 7 replaces the internals; the file path and export name are the contract)

```tsx
import { Outlet } from "react-router";

/** App frame. Task 7 adds sidebar (desktop) + bottom nav (mobile) per CLAUDE.md §9. */
export function AppShell() {
  return (
    <main id="content" className="mx-auto max-w-5xl p-4 md:p-8">
      <Outlet />
    </main>
  );
}
```

- [ ] **Step 7: Create the `StyleGuidePage.tsx` stub** (Task 8 expands it)

```tsx
import { useTranslation } from "react-i18next";

/** Design-system showcase (§40.7 QA surface). Expanded in Task 8. */
export function StyleGuidePage() {
  const { t } = useTranslation("styleguide");
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
```

- [ ] **Step 8: Create `routes.tsx`**

```tsx
import type { RouteObject } from "react-router";
import { LocaleGate } from "@/components/routing/LocaleGate";
import { LocaleRedirect } from "@/components/routing/LocaleRedirect";
import { AppShell } from "@/components/shell/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { StyleGuidePage } from "@/pages/StyleGuidePage";

/** Locale-prefixed route tree (CLAUDE.md §31). */
export const routes: RouteObject[] = [
  { path: "/", element: <LocaleRedirect /> },
  {
    path: "/:locale",
    element: <LocaleGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage section="dashboard" /> },
          { path: "tutor", element: <PlaceholderPage section="tutor" /> },
          { path: "learn", element: <PlaceholderPage section="learn" /> },
          { path: "practice", element: <PlaceholderPage section="practice" /> },
          { path: "quizzes", element: <PlaceholderPage section="quizzes" /> },
          { path: "documents", element: <PlaceholderPage section="documents" /> },
          { path: "progress", element: <PlaceholderPage section="progress" /> },
          { path: "settings", element: <PlaceholderPage section="settings" /> },
        ],
      },
      { path: "style-guide", element: <StyleGuidePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];
```

- [ ] **Step 9: Rewrite `main.tsx` and delete the placeholder app**

`apps/web/src/main.tsx` full content:

```tsx
import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import "./i18n";
import { routes } from "./routes";
import { ThemeProvider } from "./theme/ThemeProvider";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const router = createBrowserRouter(routes);

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
```

Then: `git rm apps/web/src/App.tsx apps/web/src/copy.ts`.

- [ ] **Step 10: Write routing tests `apps/web/test/routing.test.tsx`**

```tsx
import "@/i18n";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe("routing", () => {
  it("redirects / to the resolved locale and shows the dashboard placeholder", async () => {
    renderAt("/");
    // jsdom navigator.languages defaults to en-US → resolves "en"
    expect(
      await screen.findByRole("heading", { name: "Your dashboard is coming" }),
    ).toBeInTheDocument();
  });

  it("redirects an unsupported locale to the resolved one", async () => {
    renderAt("/de");
    expect(
      await screen.findByRole("heading", { name: "Your dashboard is coming" }),
    ).toBeInTheDocument();
  });

  it("renders Turkish strings and sets <html lang> on /tr", async () => {
    renderAt("/tr/tutor");
    expect(
      await screen.findByRole("heading", { name: "AI Özel Ders çok yakında" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("tr");
  });

  it("serves the style-guide route outside the app shell", async () => {
    renderAt("/en/style-guide");
    expect(
      await screen.findByRole("heading", { name: "LearWizAI Style Guide" }),
    ).toBeInTheDocument();
  });

  it("renders the localized 404 for unknown locale subpaths", async () => {
    renderAt("/tr/olmayan-sayfa");
    expect(await screen.findByRole("heading", { name: "Sayfa bulunamadı" })).toBeInTheDocument();
  });
});
```

Note: tests run in file order within one jsdom document — each `renderAt` appends; the auto `cleanup()` in setup.ts unmounts between tests, but `document.documentElement.lang` persists. If the "/tr" lang assertion conflicts with a later test, re-set `document.documentElement.lang = ""` in an `afterEach` INSIDE this test file.

- [ ] **Step 11: Run + gates**

Run: `pnpm --filter @learwizai/web test` → all suites green (theme + i18n + batch1 + batch2 + routing).
Run (root): `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check` → exit 0.
Sanity: `pnpm --filter @learwizai/web dev` is NOT required; the build + tests are the gate.

- [ ] **Step 12: Format + commit + push**

```bash
pnpm format
git add -A apps/web pnpm-lock.yaml
git commit -m "feat(web): locale routing (React Router v7), LocaleGate, placeholder pages, localized 404"
git push
```

---

### Task 7: AppShell — sidebar (desktop), bottom nav (mobile), More sheet, ThemeToggle, LanguageSwitcher, PlanCard

**Files:**

- Modify: `apps/web/src/components/shell/AppShell.tsx` (replace Task 6 minimal version)
- Create: `apps/web/src/components/shell/{SidebarNav,BottomNav,MoreSheet,ThemeToggle,LanguageSwitcher,PlanCard}.tsx`
- Test: `apps/web/test/shell.test.tsx`

**Interfaces:**

- Consumes: routes tree with `AppShell` layout (Task 6), all ui primitives (Task 3), `useTheme` (Task 1), `setLocalePreference` (Task 2), `nav`/`common` namespaces (Task 2).
- Produces: `ThemeToggle` and `LanguageSwitcher` exports from `@/components/shell/…` (reused by MoreSheet and the style guide); shell landmarks: `aside` (sidebar), two `nav`s labeled `common:aria.mainNavigation` (desktop) and `common:aria.mobileNavigation` (mobile), `main#content`.

- [ ] **Step 1: Replace `AppShell.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";

/** Application frame per CLAUDE.md §9: desktop sidebar + mobile bottom nav. */
export function AppShell() {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          {t("aria.skipToContent")}
        </a>
        <SidebarNav />
        <main id="content" className="md:pl-60">
          {/* pb-24 keeps content clear of the mobile bottom nav */}
          <div className="mx-auto max-w-5xl p-4 pb-24 md:p-8 md:pb-8">
            <Outlet />
          </div>
        </main>
        <BottomNav />
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Create `SidebarNav.tsx`**

```tsx
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  ListChecks,
  PencilLine,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PlanCard } from "./PlanCard";
import { ThemeToggle } from "./ThemeToggle";

type NavSection =
  "dashboard" | "tutor" | "learn" | "practice" | "quizzes" | "documents" | "progress" | "settings";

interface NavEntry {
  section: NavSection;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

// §9 navigation order: primary group, Progress, Settings.
const PRIMARY_NAV: NavEntry[] = [
  { section: "dashboard", to: "", icon: LayoutDashboard, end: true },
  { section: "tutor", to: "tutor", icon: Sparkles },
  { section: "learn", to: "learn", icon: BookOpen },
  { section: "practice", to: "practice", icon: PencilLine },
  { section: "quizzes", to: "quizzes", icon: ListChecks },
  { section: "documents", to: "documents", icon: FileText },
];
const SECONDARY_NAV: NavEntry[] = [{ section: "progress", to: "progress", icon: TrendingUp }];
const TERTIARY_NAV: NavEntry[] = [{ section: "settings", to: "settings", icon: Settings }];

function SidebarLink({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation("nav");
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring",
          isActive && "bg-accent text-accent-foreground",
        )
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(`items.${entry.section}`)}
    </NavLink>
  );
}

export function SidebarNav() {
  const { t } = useTranslation("nav");
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-14 items-center px-4">
        {/* Brand name is a proper noun — not translated (documented exception). */}
        <span className="text-base font-semibold text-foreground">{t("brand")}</span>
      </div>
      <nav
        aria-label={t("common:aria.mainNavigation")}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
      >
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map((entry) => (
            <SidebarLink key={entry.section} entry={entry} />
          ))}
        </div>
        <Separator className="my-2" />
        {SECONDARY_NAV.map((entry) => (
          <SidebarLink key={entry.section} entry={entry} />
        ))}
        <Separator className="my-2" />
        {TERTIARY_NAV.map((entry) => (
          <SidebarLink key={entry.section} entry={entry} />
        ))}
      </nav>
      <div className="space-y-3 border-t border-border p-3">
        <PlanCard />
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `BottomNav.tsx`** (§9 mobile: Home, Tutor, Learn, Practice, More)

```tsx
import { BookOpen, LayoutDashboard, PencilLine, Sparkles, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./MoreSheet";

function BottomLink({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
          isActive && "text-primary",
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export function BottomNav() {
  const { t } = useTranslation("nav");
  return (
    <nav
      aria-label={t("common:aria.mobileNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card md:hidden"
    >
      <BottomLink to="" end icon={LayoutDashboard} label={t("mobile.home")} />
      <BottomLink to="tutor" icon={Sparkles} label={t("items.tutor")} />
      <BottomLink to="learn" icon={BookOpen} label={t("items.learn")} />
      <BottomLink to="practice" icon={PencilLine} label={t("items.practice")} />
      <MoreSheet />
    </nav>
  );
}
```

- [ ] **Step 4: Create `MoreSheet.tsx`**

```tsx
import { FileText, ListChecks, MoreHorizontal, Settings, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const MORE_ITEMS = [
  { section: "quizzes", to: "quizzes", icon: ListChecks },
  { section: "documents", to: "documents", icon: FileText },
  { section: "progress", to: "progress", icon: TrendingUp },
  { section: "settings", to: "settings", icon: Settings },
] as const;

export function MoreSheet() {
  const { t } = useTranslation("nav");
  return (
    <Sheet>
      <SheetTrigger
        className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("common:aria.moreMenu")}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
        {t("mobile.more")}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{t("common:aria.moreMenu")}</SheetTitle>
          <SheetDescription className="sr-only">{t("common:aria.moreMenu")}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-2" aria-label={t("common:aria.moreMenu")}>
          {MORE_ITEMS.map(({ section, to, icon: Icon }) => (
            <SheetClose asChild key={section}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`items.${section}`)}
              </NavLink>
            </SheetClose>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

If the vendored `SheetTrigger` does not forward a raw `className`+`aria-label` cleanly (it renders a button by default), wrap: `<SheetTrigger asChild><button type="button" className=… aria-label=…>…</button></SheetTrigger>`.

- [ ] **Step 5: Create `ThemeToggle.tsx`**

```tsx
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";

const MODES = [
  { mode: "system", icon: Monitor, labelKey: "theme.system" },
  { mode: "light", icon: Sun, labelKey: "theme.light" },
  { mode: "dark", icon: Moon, labelKey: "theme.dark" },
] as const satisfies readonly { mode: ThemeMode; icon: LucideIcon; labelKey: string }[];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("theme.label")}>
          <Sun className="size-4 dark:hidden" aria-hidden="true" />
          <Moon className="hidden size-4 dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {MODES.map(({ mode: value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setMode(value)}
            className={cn(mode === value && "bg-accent text-accent-foreground")}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Create `LanguageSwitcher.tsx`**

```tsx
import type { Locale } from "@learwizai/types";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { setLocalePreference } from "@/i18n/localePrefs";

// Native language names are locale-invariant proper nouns (documented
// exception to the no-hardcoded-strings rule, same as the brand name).
const LABELS: Record<Locale, string> = { en: "English", tr: "Türkçe" };

/** EN↔TR toggle: persists the choice (§6.3 tier 2) and swaps the route locale. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const current: Locale = locale === "tr" ? "tr" : "en";
  const next: Locale = current === "en" ? "tr" : "en";

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("language.switchAria", { language: LABELS[next] })}
      onClick={() => {
        setLocalePreference(next);
        const rest = pathname.replace(/^\/(?:en|tr)(?=\/|$)/, "");
        navigate(`/${next}${rest}${search}`);
      }}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{LABELS[next]}</span>
    </Button>
  );
}
```

- [ ] **Step 7: Create `PlanCard.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Sidebar plan/usage slot (§9). Real plan + usage arrive with entitlements
 * (§17) and billing (Step 7) — until then show the free label only,
 * NEVER fake quota numbers (spec §7.2, CLAUDE.md §29).
 */
export function PlanCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("plan.currentPlan")}</span>
          <Badge>{t("plan.free")}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("plan.usageUnavailable")}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Write shell tests `apps/web/test/shell.test.tsx`**

```tsx
import "@/i18n";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { ThemeProvider } from "@/theme/ThemeProvider";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    // jsdom shares cookies across tests in a file — clear the locale cookie.
    document.cookie = "learwiz_locale=;path=/;max-age=0";
  });

  it("renders the sidebar with English labels and marks the active route", async () => {
    renderAt("/en");
    const sidebar = await screen.findByRole("complementary");
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("link", { name: "AI Tutor" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Documents" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders Turkish labels on /tr", async () => {
    renderAt("/tr");
    const sidebar = await screen.findByRole("complementary");
    expect(within(sidebar).getByRole("link", { name: "Panel" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "AI Özel Ders" })).toBeInTheDocument();
  });

  it("renders the mobile bottom nav landmark", async () => {
    renderAt("/en");
    await screen.findByRole("complementary");
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
  });

  it("language switcher persists the choice and swaps the route locale", async () => {
    const user = userEvent.setup();
    renderAt("/en/tutor");
    // Regex match: the aria-label interpolates the NEXT locale's native name.
    await user.click(await screen.findByRole("button", { name: /Switch language/i }));
    // After switching to tr, the sidebar shows Turkish labels
    const sidebar = await screen.findByRole("complementary");
    expect(await within(sidebar).findByRole("link", { name: "Panel" })).toBeInTheDocument();
    expect(document.cookie).toContain("learwiz_locale=tr");
    expect(document.documentElement.lang).toBe("tr");
  });

  it("theme toggle applies dark mode and persists it", async () => {
    const user = userEvent.setup();
    renderAt("/en");
    await user.click(await screen.findByRole("button", { name: "Theme" }));
    await user.click(await screen.findByRole("menuitem", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("learwiz_theme")).toBe("dark");
  });

  it("shell has no axe violations", async () => {
    const { baseElement } = renderAt("/en");
    await screen.findByRole("complementary");
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
```

Note: `language.switchAria` interpolates `{{language}}` with the NEXT locale's native name (on `/en` it reads "Switch language, currently Türkçe") — the test therefore matches the button with a regex, robust against the interpolated value.

- [ ] **Step 9: Run + gates**

Run: `pnpm --filter @learwizai/web test` → all suites green (theme + i18n + batch1 + batch2 + routing + shell).
Run (root): `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check` → exit 0.

- [ ] **Step 10: Format + commit + push**

```bash
pnpm format
git add apps/web
git commit -m "feat(web): AppShell — 240px sidebar, mobile bottom nav, theme + language switchers, plan card"
git push
```

---

### Task 8: Style guide showcase — full `/:locale/style-guide`

**Files:**

- Modify: `apps/web/src/pages/StyleGuidePage.tsx` (replace Task 6 stub)

**Interfaces:**

- Consumes: every vendored primitive + state components + ThemeToggle + `styleguide` namespace (`sections.*`, `demo.*` keys from Task 2).
- Produces: the standing visual-QA surface (spec §8.3, CLAUDE.md §40.7).

- [ ] **Step 1: Replace `StyleGuidePage.tsx` with the full showcase**

```tsx
import { Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Token names and variant names are code identifiers — shown verbatim, not translated.
const SWATCHES = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "primary", className: "bg-primary" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "accent", className: "bg-accent" },
  { name: "card", className: "bg-card" },
  { name: "destructive", className: "bg-destructive" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "info", className: "bg-info" },
  { name: "border", className: "bg-border" },
] as const;

const BUTTON_VARIANTS = ["default", "secondary", "outline", "ghost", "destructive"] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6">
      <h2 id={`${id}-heading`} className="mb-3 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="rounded-lg border border-border bg-card p-5">{children}</div>
    </section>
  );
}

/** Design-system showcase — the standing §40.7 visual-QA surface. */
export function StyleGuidePage() {
  const { t } = useTranslation("styleguide");
  const [progress, setProgress] = useState(40);

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Section id="theme" title={t("sections.theme")}>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <p className="text-sm text-muted-foreground">{t("demo.themeNote")}</p>
        </div>
      </Section>

      <Section id="tokens" title={t("sections.tokens")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name} className="flex items-center gap-2">
              <span
                className={cn("size-8 rounded-md border border-border", swatch.className)}
                aria-hidden="true"
              />
              <code className="text-xs text-muted-foreground">{swatch.name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section id="typography" title={t("sections.typography")}>
        <div className="space-y-2">
          <p className="text-3xl font-semibold text-foreground">Heading — 30px / 600</p>
          <p className="text-xl font-semibold text-foreground">Heading — 20px / 600</p>
          <p className="text-base font-medium text-foreground">Body — 16px / 500</p>
          <p className="text-sm text-muted-foreground">Secondary — 14px / muted-foreground</p>
        </div>
      </Section>

      <Section id="radius" title={t("sections.radius")}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="size-16 rounded-sm bg-primary/20 ring-1 ring-primary" title="sm — 6px" />
          <div className="size-16 rounded-md bg-primary/20 ring-1 ring-primary" title="md — 10px" />
          <div className="size-16 rounded-lg bg-primary/20 ring-1 ring-primary" title="lg — 14px" />
          <div className="size-16 rounded-xl bg-primary/20 ring-1 ring-primary" title="xl — 18px" />
          <div className="size-16 rounded-full bg-primary/20 ring-1 ring-primary" title="full" />
          <div className="rounded-md border border-border p-3 shadow-sm">
            <code className="text-xs text-muted-foreground">shadow-sm</code>
          </div>
        </div>
      </Section>

      <Section id="buttons" title={t("sections.buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              <code>{variant}</code>
            </Button>
          ))}
          <Button disabled>
            <code>disabled</code>
          </Button>
          <Button size="sm">
            <code>sm</code>
          </Button>
          <Button size="lg">
            <code>lg</code>
          </Button>
          <Button size="icon" aria-label="Icon button example">
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section id="forms" title={t("sections.forms")}>
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sg-email">{t("demo.inputLabel")}</Label>
            <Input id="sg-email" type="email" placeholder={t("demo.inputPlaceholder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-textarea">Textarea</Label>
            <Textarea id="sg-textarea" placeholder={t("demo.textareaPlaceholder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-select">Select</Label>
            <Select>
              <SelectTrigger id="sg-select" className="w-56">
                <SelectValue placeholder={t("demo.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">{t("demo.optionA")}</SelectItem>
                <SelectItem value="b">{t("demo.optionB")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section id="cards" title={t("sections.cards")}>
        <div className="flex flex-wrap items-start gap-4">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>{t("demo.sampleTitle")}</CardTitle>
              <CardDescription>{t("demo.sampleDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge>default</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="outline">outline</Badge>
                <Badge variant="success">success</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="error">error</Badge>
                <Badge variant="info">info</Badge>
              </div>
            </CardContent>
          </Card>
          <Separator orientation="vertical" className="h-24" />
          <div className="space-y-2">
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <code className="text-xs text-muted-foreground">Avatar</code>
          </div>
        </div>
      </Section>

      <Section id="overlays" title={t("sections.overlays")}>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("demo.dialogTitle")}</DialogTitle>
                <DialogDescription>{t("demo.dialogDescription")}</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{t("demo.sheetTitle")}</SheetTitle>
                <SheetDescription>{t("demo.sheetDescription")}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{t("demo.menu")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>{t("demo.menuItem")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>{t("demo.tooltip")}</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section id="tabs" title={t("sections.tabs")}>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">{t("demo.tabA")}</TabsTrigger>
            <TabsTrigger value="b">{t("demo.tabB")}</TabsTrigger>
          </TabsList>
          <TabsContent value="a">
            <p className="text-sm text-muted-foreground">{t("demo.tabA")}</p>
          </TabsContent>
          <TabsContent value="b">
            <p className="text-sm text-muted-foreground">{t("demo.tabB")}</p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section id="feedback" title={t("sections.feedback")}>
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              toast(t("demo.toast"));
            }}
          >
            Toast
          </Button>
          <div className="flex max-w-md items-center gap-3">
            <Progress value={progress} aria-label="Demo progress" className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProgress((value) => (value >= 100 ? 0 : value + 20));
              }}
            >
              {t("demo.increaseProgress")}
            </Button>
          </div>
          <div className="max-w-md space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Section>

      <Section id="states" title={t("sections.states")}>
        <div className="grid gap-4">
          <EmptyState title={t("demo.emptyTitle")} description={t("demo.emptyDescription")} />
          <LoadingState />
          <ErrorState
            onRetry={() => {
              toast(t("demo.retryFired"));
            }}
          />
        </div>
      </Section>
    </main>
  );
}
```

Note: Tooltip here relies on the app-level `TooltipProvider` (AppShell). The style-guide route is OUTSIDE the shell — wrap the overlays section's Tooltip usage in its own `<TooltipProvider>` (import it and wrap the Tooltip element) so the page works standalone. Add `TooltipProvider` to the tooltip import list and wrap: `<TooltipProvider><Tooltip>…</Tooltip></TooltipProvider>`.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @learwizai/web test` → green (routing test still asserts the style-guide heading).
Run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check` → exit 0.

- [ ] **Step 3: Format + commit + push**

```bash
pnpm format
git add apps/web
git commit -m "feat(web): style-guide showcase — all primitives, tokens, typography, states"
git push
```

---

### Task 9: QA sweep (§40.7) + fixes

**Files:** any web file needing fixes found by the sweep (no new files expected).

**Interfaces:**

- Consumes: the complete Step 2 UI (Tasks 1–8).
- Produces: QA evidence in the report + a user-run manual checklist (executed on staging after Task 10's push); any fix commits.

- [ ] **Step 1: Full gates**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check` → all exit 0. Record test counts.

- [ ] **Step 2: Hardcoded-string audit (CLAUDE.md §23/§37.3)**

Run: `git grep -nE ">[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü ]{2,}<" -- apps/web/src ":(exclude)apps/web/src/components/ui"`
Triage every hit: allowed = brand "LearWizAI", native language names ("English", "Türkçe"), code identifiers shown in `<code>` on the style guide, typography spec labels ("Heading — 30px / 600"). Anything else is a violation → move the string into the right namespace (en + tr together), rerun parity test.

- [ ] **Step 3: Turkish expansion check (§40.7)**

Compare en/tr string lengths per key (short node script or manual scan of the JSONs): flag tr values ≥ 40 % longer than en that feed fixed-width surfaces (nav labels, bottom-nav labels, badges). Verify the shell uses flexible widths (no `w-*` clamps on labels, bottom nav grid accommodates "AI Özel Ders" / "Alıştırma"). Fix any clipping (e.g. `truncate` + `title` attribute where unavoidable).

- [ ] **Step 4: Dark-mode token completeness**

Verify every custom property defined in `:root` of `apps/web/src/index.css` has a `.dark` counterpart (list both sets in the report). Spot-check contrast pairs against §5.2: foreground-on-background, primary-foreground-on-primary, muted-foreground-on-card in BOTH modes (computed contrast ≥ 4.5:1 for body text; record ratios).

- [ ] **Step 5: Motion + a11y verification**

`git grep -n "prefers-reduced-motion" apps/web/src/index.css` → present.
`git grep -n "focus-visible" apps/web/src/components/shell` → present on interactive items.
Confirm axe assertions exist in: batch1 states test, batch2 dialog test, shell test. Run `pnpm --filter @learwizai/web test` once more → green.

- [ ] **Step 6: Bundle sanity**

From the Step 1 build output, record the main JS chunk size (vite prints it). Expectation: growth from i18n JSON + Radix is acceptable for MVP; if vite emits a >500 kB chunk warning, note it in the report as a Step 3 lazy-loading candidate (no action now — spec §6.2 threshold note).

- [ ] **Step 7: Fixes + commit (only if Steps 2-5 found violations)**

```bash
pnpm format
git add apps/web
git commit -m "fix(web): QA sweep findings — hardcoded strings, TR expansion, contrast"
git push
```

- [ ] **Step 8: Write the manual checklist into the report** (user runs it on staging after Task 10): desktop sidebar layout at 1280px; mobile bottom nav at 390px; More sheet opens/closes; theme cycle system→light→dark with refresh persistence (no flash); language toggle on a deep route keeps the page; /en/style-guide and /tr/style-guide render all sections; Tab-key walk through sidebar → content → bottom nav; reduced-motion OS setting stops spinners/transitions.

---

### Task 10: Docs + production deploy + DoD verification

**Files:**

- Create: `docs/localization.md`, `docs/design-system.md`
- Modify: `docs/architecture.md` (frontend section), `README.md` (feature/layout additions)

**Interfaces:**

- Consumes: everything from Tasks 0–9; staging auto-deploy on push; production via `gh workflow run ci.yml -F deploy_production=true` (dispatch IS the gate — see Step 1 spec ruling; no reviewer approval exists on the free plan).
- Produces: §44 doc growth; Step 2 closed against spec §13 DoD.

- [ ] **Step 1: Create `docs/localization.md`**

````markdown
# Localization (i18n)

Locales: `en` (default/fallback) and `tr` — CLAUDE.md §6. Library: react-i18next.

## Resolution order (§6.3)

```text
Authenticated user's saved locale   (auth step — slot reserved, not yet implemented)
  → explicit guest choice: cookie `learwiz_locale` (authoritative) + localStorage mirror
  → browser: first navigator.languages match in {en, tr}
  → "en"
```

Implemented in `apps/web/src/i18n/resolveLocale.ts` (pure, unit-tested); live-browser
reads in `localePrefs.ts`. The `/` route redirects to the resolved locale; `/:locale`
params are validated with `localeSchema` from `@learwizai/validation` (invalid → redirect).

## File layout (§6.2)

```text
apps/web/src/i18n/locales/{en,tr}/<namespace>.json
```

| Namespace                                                                   | Owner step          | Contents                                                |
| --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| common                                                                      | Step 2              | actions, states, theme, language, plan, errors, aria    |
| nav                                                                         | Step 2              | brand, nav items, mobile labels, placeholders, notFound |
| styleguide                                                                  | Step 2              | showcase titles + demo copy                             |
| auth, dashboard, tutor, learn, practice, quiz, documents, progress, billing | their feature steps | created by the owning step                              |

## Rules

- Semantic keys only (`nav.items.tutor`, never `t("AI Tutor")`).
- Every string lands in en AND tr in the same commit — the parity test
  (`apps/web/test/parity.test.ts`) fails CI on key drift or empty values.
- Typed keys: `t()` is compile-time-checked against the en JSONs
  (`src/i18n/types.d.ts` augmentation); unknown keys fail `pnpm typecheck`.
- Documented exceptions to no-hardcoded-strings: brand name "LearWizAI" and native
  language names ("English", "Türkçe") are locale-invariant proper nouns.
- Formatting: use `formatDate/formatTime/formatNumber/formatRelativeTime` from
  `@/i18n/format` (Intl wrappers, active-locale aware) — never hand-rolled patterns.
- `<html lang>`, hreflang alternates and canonical are synced per route
  (`LocaleGate` + `src/i18n/head.ts`).

## AI locale context (§6.4)

`getActiveLocale()` from `@/i18n` is the accessor API calls must use to send
`locale` to the worker (lands with the AI Tutor step). Generated content preserves
its generation locale.
````

- [ ] **Step 2: Create `docs/design-system.md`**

```markdown
# Design System

Foundation per CLAUDE.md §8; vendored shadcn/ui (Radix) + Tailwind v4 tokens.
Live showcase: `/{locale}/style-guide` on every environment
(e.g. https://learwizai-api-staging.orhankeskinn1.workers.dev/en/style-guide).

## Tokens

CSS custom properties in `apps/web/src/index.css` (`:root` light, `.dark` dark),
mapped to Tailwind utilities via `@theme inline` (`bg-background`, `text-foreground`,
`bg-primary`, `text-muted-foreground`, `border-border`, `bg-success|warning|info|destructive`, …).

| Token                                  | Light                                 | Dark    |
| -------------------------------------- | ------------------------------------- | ------- |
| background                             | #F8FAFC                               | #0F172A |
| card                                   | #FFFFFF                               | #1E293B |
| foreground                             | #0F172A                               | #F8FAFC |
| muted-foreground                       | #94A3B8                               | #94A3B8 |
| border                                 | #E2E8F0                               | #334155 |
| primary (foreground #FFFFFF)           | #6366F1                               | #6366F1 |
| success / warning / destructive / info | #10B981 / #F59E0B / #EF4444 / #3B82F6 | same    |

Radius (§8.6): sm 6px · md 10px (default) · lg 14px · xl 18px · full — via `--radius: 0.625rem`.
Shadows (§8.7): subtle levels only; no heavy floating cards. Gradients rare.
Typography (§8.4): Inter Variable self-hosted (`@fontsource-variable/inter`, latin+latin-ext,
`font-display: swap`); headings 600–700, body 400–500; `font-sans` mapped in `@theme`.

## Theme

`system | light | dark` via `ThemeProvider` (`src/theme/`): localStorage `learwiz_theme`,
`data-theme` attr + `.dark` class on `<html>`, `matchMedia` follow in system mode,
no-flash inline script in `index.html`. Motion is subtle (150–200ms) and globally
disabled under `prefers-reduced-motion` (§8.8/§25).

## Component inventory

- Vendored (`src/components/ui/`): button, input, textarea, select, label, card, badge
  (+ success/warning/error/info variants), separator, dialog, sheet, tabs, dropdown-menu,
  tooltip, progress, skeleton, avatar, sonner toaster (adapted to our ThemeProvider — no next-themes).
- Custom states (`src/components/states/`): EmptyState, LoadingState (role=status),
  ErrorState (role=alert + retry).
- Shell (`src/components/shell/`): AppShell, SidebarNav (240px, §9), BottomNav + MoreSheet
  (mobile §9), ThemeToggle, LanguageSwitcher, PlanCard (placeholder until billing step —
  never renders fake quotas).

## Conventions

- cva variants + `className` escape hatch on every component; typed props; React 19 ref-as-prop.
- No hardcoded user-facing strings — text via props or `common.json` defaults (exceptions:
  brand, native language names, code identifiers on the style guide).
- Adding a component: `pnpm dlx shadcn@latest add <name>` in `apps/web` → align to tokens →
  add a test to the batch suites → add a demo section to `StyleGuidePage` → update this doc.

## Testing

vitest + jsdom + @testing-library (+ vitest-axe): component interaction tests,
state-component a11y, shell landmark/label tests, i18n parity, locale resolution,
Intl formatting. QA checklist lives in `docs/deployment.md` smoke sections and the
Step 2 plan's Task 9.
```

- [ ] **Step 3: Update `docs/architecture.md`**

Append a new section after "## Monorepo" (keep existing content intact):

````markdown
## Frontend architecture (Step 2)

```text
main.tsx → ThemeProvider → RouterProvider (createBrowserRouter, routes.tsx)
  /            → LocaleRedirect (resolveLocale → /{locale})
  /:locale     → LocaleGate (localeSchema validation, i18n + <html lang> + hreflang sync)
      ├─ AppShell (sidebar / bottom nav / toaster) → placeholder pages (EmptyState)
      └─ style-guide → StyleGuidePage (design-system showcase)
  *            → localized 404
```

Styling: Tailwind v4 + CSS-variable tokens (§8 palette, dark-mode-ready); components
vendored from shadcn/ui (Radix). i18n: react-i18next, en/tr JSON namespaces, typed keys,
CI-enforced parity. Details: `docs/design-system.md`, `docs/localization.md`.
````

Also update the layout tree in architecture.md if it lists `apps/web` children: add `components/{ui,states,shell,routing}`, `pages/`, `theme/`, `i18n/`, `test/` entries.

- [ ] **Step 4: Update `README.md`**

- In the Stack line add: `react-i18next (en/tr)`, `shadcn/ui (Radix)`, `React Router 7`.
- In the Layout block, extend the `apps/web` row comment: `# SPA — locale-routed shell + design system (see docs/design-system.md)`.
- Add a "Design system & i18n" section after Environments:

```markdown
## Design system & i18n

- Tokens/components: [docs/design-system.md](docs/design-system.md) — live showcase at `/{en|tr}/style-guide` on every environment.
- Localization rules (en/tr, parity test, typed keys): [docs/localization.md](docs/localization.md).
```

- [ ] **Step 5: Gates + commit + push (staging deploys automatically)**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format` then `pnpm format:check` → all 0.

```bash
git add README.md docs/
git commit -m "docs: localization + design-system guides, architecture/README updates"
git push
gh run list --limit 1   # watch: gh run watch <run-id> --exit-status → checks + deploy-staging + smoke green
```

- [ ] **Step 6: Production deploy (manual dispatch — the dispatch IS the gate)**

```bash
gh workflow run ci.yml -F deploy_production=true
gh run list --workflow ci.yml --limit 1
gh run watch <run-id> --exit-status
```

Expected: checks ✓ → deploy-production ✓ INCLUDING the Task 0 smoke step (curl+jq assertion on production health).

- [ ] **Step 7: Final smoke from this machine (ISP workaround)**

```powershell
$apexIp = curl.exe -s -o NUL -w "%{remote_ip}" --max-time 10 https://workers.dev
foreach ($h in @("learwizai-api-dev","learwizai-api-staging","learwizai-api")) {
  curl.exe -s --max-time 15 --resolve "${h}.orhankeskinn1.workers.dev:443:$apexIp" "https://${h}.orhankeskinn1.workers.dev/api/health"
  ""
}
```

Expected: three JSON bodies with `environment` dev/staging/production and `checks.db:"ok"`.

- [ ] **Step 8: DoD verification (spec §13) — record each line in the report**

- CI green on main including new web suites + deploy smokes (run id).
- Parity test green; hardcoded-string audit (Task 9 Step 2) clean.
- All components exist with tests and appear on `/style-guide` (both locales).
- Theme system/light/dark works, no flash (manual checklist handed to user).
- AppShell responsive landmarks verified in shell tests; axe clean.
- Locale routing: `/` redirect, invalid-locale redirect, switcher persistence, lang/hreflang — routing tests green.
- Staging AND production deployed; production smoke green in CI + locally (via --resolve).
- `docs/localization.md` + `docs/design-system.md` committed; architecture.md + README updated.

---

## Self-Review Record (author)

- **Spec coverage:** §4 chores → Task 0 · §5 tokens/typography/theme/motion → Task 1 (+8 showcase, +9 contrast check) · §6 i18n (structure, typed keys, parity, resolution, routing integration, Intl utils) → Task 2 (+6 gate, +7 switcher) · §7 routing/AppShell → Tasks 6–7 · §8 components (vendored set, badge semantics, state trio, showcase) → Tasks 3–5, 7, 8 · §9 testing/QA → Tasks 1–8 suites + Task 9 sweep · §10 docs → Task 10 · §11 delivery order → task order identical · §12 risks: CLI friction → Task 3 Step 1 BLOCKED rule + Task 1 manual fallback; TR expansion → Task 9 Step 3; typed-key churn → isolated types.d.ts; contrast → Task 9 Step 4; bundle → Task 9 Step 6; cookie/storage split-brain → single-writer `localePrefs` (Task 2 Step 7) · §13 DoD → Task 10 Step 8.
- **Placeholder scan:** all code blocks are complete file contents; style-guide stub (Task 6) and minimal AppShell (Task 6) are deliberate, replaced in Tasks 7–8 with full content — no TBDs. Runtime values (URLs, run ids) reference recorded constants (subdomain `orhankeskinn1`).
- **Type/name consistency:** `ThemeMode`/`useTheme` (T1) = consumed by sonner adaptation (T3), ThemeToggle (T7), shell tests (T7); `resolveBrowserLocale`/`setLocalePreference`/`LOCALE_COOKIE` (T2) = consumed by LocaleRedirect/LocaleGate (T6), LanguageSwitcher (T7), tests; `PLACEHOLDER_SECTIONS`/`PlaceholderSection` (T6) used by routes (T6); `EmptyState/LoadingState/ErrorState` prop shapes identical across T4 definition, T6/T8 usage; JSON keys referenced by components (`aria.skipToContent`, `aria.mainNavigation`, `aria.mobileNavigation`, `language.switchAria`, `plan.*`, `theme.*`, `states.loading`, `errors.unexpected`, `actions.retry`, `nav.items.*`, `nav.mobile.*`, `nav.placeholders.*`, `nav.notFound.*`, `styleguide.sections.*`, `styleguide.demo.*`) all exist in BOTH Task 2 locale files (parity test enforces at runtime too).
- **Known judgment points flagged inline:** vitest-axe contingency (T1), shadcn CLI fallback (T1/T3), sonner next-themes swap (T3), badge cva pattern mirroring (T3), vendored export-name drift (T5), SheetTrigger asChild variant (T7), style-guide TooltipProvider wrap (T8), aria-label regex in shell test (T7 Step 8 note).
