# LearWizAI — Step 2: Design System + i18n Foundation Design Spec

- **Date:** 2026-09-11
- **Status:** Design approved in chat (Sections 1–6); awaiting spec review
- **Scope:** Step 2 per CLAUDE.md §35 / §48 item 3: design tokens, typography, core UI primitives, navigation/app shell, responsive layout, and the en/tr i18n foundation. Includes Step 1 carry-over chores.
- **Upstream:** Step 1 spec `docs/superpowers/specs/2026-09-11-step1-foundation-design.md` (closed; all environments live). Binding product rules: CLAUDE.md §6 (i18n), §8 (design direction), §9 (layout), §24 (components), §25 (responsive/a11y), §31 (routes), §36/§42.3 (DoD).

---

## 1. Goals

- Replace the Step 1 placeholder app with a locale-aware routed application shell.
- Establish the design-token architecture (light-first, dark-mode-ready) exactly per CLAUDE.md §8.
- Establish the i18n foundation (en/tr) exactly per CLAUDE.md §6: semantic keys, typed key checking, mechanical en/tr parity enforcement, locale resolution, Intl formatting utilities.
- Deliver the core UI primitive set (vendored shadcn/ui over Radix) with tests and a `/style-guide` showcase.
- Close the Step 1 final-review carry-over chores first (CI post-deploy smoke, least-privilege permissions, allowBuilds alignment, vite.config typecheck, conditional bumps).

## 2. Decisions (approved in brainstorming)

| Area                   | Decision                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| i18n library           | react-i18next + i18next (JSON namespaces per §6.2)                                                                                           |
| Router                 | React Router v7, library mode (SPA; no SSR/prerender in MVP)                                                                                 |
| Component base         | shadcn/ui vendored into the repo (Radix primitives + Tailwind), owned as our code                                                            |
| Step 2 component scope | Core set + custom state components + `/style-guide` showcase; domain components (AIMessage, QuizQuestion, …) deferred to their feature steps |
| Delivery               | Foundation-first: chores → tokens/theme → i18n → routing → shell → primitives in batches → showcase → QA → deploy                            |
| Theme                  | CSS variables + Tailwind v4 `@theme inline`; `system/light/dark` ThemeProvider; no-flash inline script                                       |
| Font                   | Inter variable, self-hosted via `@fontsource-variable/inter` (latin + latin-ext)                                                             |

## 3. Out of Scope (deferred by step order)

| Item                                                                                           | Lands in                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Domain components (AIMessage, UserMessage, QuizQuestion, LessonBlock, TopicCard, DocumentCard) | Their feature steps (3+)                                    |
| Landing page (§10.1), real dashboard content (§10.2)                                           | Step 3 / Step 5+                                            |
| SSR/prerender for SEO; landing SEO strategy                                                    | Production launch                                           |
| AI locale context in requests (§6.4)                                                           | Step 3 (AI Tutor) — `getActiveLocale()` helper prepared now |
| Registered-user locale from DB (§6.3 first tier)                                               | Auth step — resolution chain designed for it now            |
| Email/notification template localization (§6.1)                                                | Auth/email step                                             |
| Real plan/usage data in the shell card                                                         | Billing step (Step 7) — placeholder shows no fake quotas    |
| Flashcards, voice, adaptive learning visuals                                                   | Phase 2/3                                                   |

## 4. Task 0 — Step 1 carry-over chores (single chore task, one commit)

From the Step 1 final-review triage:

1. **CI post-deploy smoke (M-10, priority):** in both deploy jobs of `.github/workflows/ci.yml`, after the deploy step add a smoke step: `curl -fsS <env-url>/api/health` piped to `jq -e` asserting `status=="ok"`, `environment` equals the job's environment, and `checks.db=="ok"`. GitHub runners reach `*.workers.dev` directly (no `--resolve` workaround needed there). URLs: `https://learwizai-api-staging.orhankeskinn1.workers.dev` / `https://learwizai-api.orhankeskinn1.workers.dev`.
2. **Least privilege (M-4):** top-level `permissions: contents: read` in ci.yml.
3. **allowBuilds alignment (M-2):** make `allowBuilds` and `onlyBuiltDependencies` memberships consistent in `pnpm-workspace.yaml` and add a one-line comment explaining the pnpm 11 dual mechanism.
4. **vite.config typecheck (M-3):** add `vite.config.ts` to `apps/web/tsconfig.json` `include`.
5. **Conditional bumps:** actions v5 (`actions/checkout`, `actions/setup-node`) if stable; eslint 10 only if `typescript-eslint` declares support — otherwise keep and note.

## 5. Token & theme architecture

### 5.1 Token mechanism

- Tokens defined as CSS custom properties in `apps/web/src/index.css` under `:root` (light) and `.dark` (dark), consumed by Tailwind v4 via `@theme inline` so utilities (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`, `bg-destructive`, …) work everywhere, shadcn-compatible.
- Semantic token names: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `success`, `warning`, `info`, `border`, `input`, `ring`, `radius`.

### 5.2 Values (exactly per CLAUDE.md §8.2/§8.3)

Light: background `#F8FAFC`; card/surface `#FFFFFF`; muted/surface-secondary `#F1F5F9`; foreground `#0F172A`; secondary text `#64748B`; muted-foreground `#94A3B8`; border `#E2E8F0`; primary `#6366F1` (foreground `#FFFFFF`).
Dark: background `#0F172A`; card `#1E293B`; foreground `#F8FAFC`; secondary/muted-fg `#94A3B8`; border `#334155`; primary stays `#6366F1` with `#FFFFFF` foreground (contrast verified in the QA sweep for both modes).
Semantic (both modes): success `#10B981`, warning `#F59E0B`, destructive/error `#EF4444`, info `#3B82F6`.
Radius scale (§8.6): 6 / 10 / 14 / 18 px + full; default component radius 10px. Shadows (§8.7): two subtle levels only; no heavy floating cards. Spacing: Tailwind's 4px grid satisfies §8.5 (documented, not re-scaled). Gradients rare by default (§8.2).

### 5.3 Typography

Inter variable self-hosted (`@fontsource-variable/inter`, subsets latin + latin-ext for Turkish diacritics, `font-display: swap`); `font-sans` mapped in `@theme`. Headings 600–700, body 400–500 (§8.4). No marketing-scale giant headings in app UI.

### 5.4 Theme provider

- Modes: `system | light | dark` (§8.3). Persisted in `localStorage` key `learwiz_theme`.
- Applied as `data-theme="light|dark"` + `.dark` class on `<html>`; system mode follows `prefers-color-scheme` via `matchMedia` listener.
- **No-flash:** inline pre-paint script in `index.html` reads storage and sets the attributes before first render.
- `ThemeToggle` component (sidebar footer + mobile More sheet).

### 5.5 Motion (§8.8)

Subtle transitions only (150–200ms ease-out) for hover/focus, dialogs, progress, skeleton shimmer. Global `prefers-reduced-motion` handling disables non-essential motion (§25).

## 6. i18n foundation

### 6.1 Structure (§6.2)

`apps/web/src/i18n/locales/{en,tr}/<namespace>.json`. Step 2 ships populated namespaces: `common` (buttons, states, aria labels), `nav` (shell navigation), `styleguide`. Remaining namespaces from §6.2 (auth, dashboard, tutor, learn, practice, quiz, documents, progress, billing) are added by the steps that own them; the convention is documented in `docs/localization.md`.

### 6.2 Rules and mechanics

- Semantic keys only (`nav.items.tutor`, never `t("AI Tutor")`) — §6.2.
- English is the fallback (`fallbackLng: "en"`) — §6.
- **Typed keys:** i18next TypeScript augmentation binds `t()` key autocompletion/validation to the `en` JSON resources; unknown keys fail `pnpm typecheck`.
- **Parity test (mechanical §6.1):** a vitest unit test deep-compares en/tr key trees for every namespace; missing or extra keys fail CI.
- Loading: static JSON imports bundled at build time (initial namespaces are small); per-namespace lazy loading may be introduced when the bundle warrants it (documented threshold, not now).

### 6.3 Locale resolution (§6.3, adapted for pre-auth)

1. Registered-user saved locale — **not available until auth step**; the chain is designed with this slot first.
2. Explicit guest selection: cookie `learwiz_locale` (mirrored in localStorage) set by the LanguageSwitcher.
3. Browser: first match of `navigator.languages` against `{en, tr}`.
4. Fallback: `en`.

Implemented in a pure, unit-tested `resolveLocale()` module; the `/` route redirects to `/{resolved}`.

### 6.4 Routing integration

- Routes are `/:locale/*`; the `locale` param is validated with `localeSchema` from `packages/validation` (first real consumer of the Step 1 contract lock). Invalid → redirect to resolved locale.
- `<html lang>` synced to the active locale; `hreflang` alternates (en/tr) + canonical link per route (§31 SEO-friendly baseline).
- `LanguageSwitcher` swaps the locale segment in place (same page), writes cookie + localStorage.
- `getActiveLocale()` exported for future API calls (§6.4 AI locale context lands with Step 3).

### 6.5 Formatting utilities (§6.1)

`src/i18n/format.ts`: `formatDate`, `formatTime`, `formatNumber`, `formatRelativeTime` wrapping `Intl.DateTimeFormat` / `Intl.NumberFormat` / `Intl.RelativeTimeFormat` with the active locale; unit-tested for en and tr (including Turkish plural/relative forms).

## 7. Routing & AppShell

### 7.1 Router

React Router v7 library mode (`BrowserRouter` + route tree; SPA, no SSR in MVP). Route tree:

- `/` → `LocaleRedirect`
- `/:locale` → `AppShell` (layout route with `<Outlet/>`)
  - index → dashboard placeholder (localized EmptyState; real dashboard Step 5+)
  - `tutor`, `learn`, `practice`, `quizzes`, `documents`, `progress`, `settings` → localized placeholder pages ("available in a later step", via EmptyState)
- `/:locale/style-guide` → showcase, outside the shell (full width)
- `*` → localized 404

### 7.2 AppShell (§9)

- **Desktop (≥768px):** fixed 240px sidebar — logo; primary nav: Dashboard, AI Tutor, Learn, Practice, Quizzes, Documents; divider; Progress; divider; Settings. Sidebar footer: plan/usage card (placeholder — localized plan label, **no fake quota values**; real data with billing step), ThemeToggle, LanguageSwitcher.
- **Mobile (<768px):** sticky bottom nav — Home, Tutor, Learn, Practice, More. "More" opens a Radix Sheet containing Quizzes, Documents, Progress, Settings, ThemeToggle, LanguageSwitcher.
- Main content region is a `main` landmark; sidebar is `aside`/`nav` with `aria-current` on the active item; visible focus states; full keyboard operability (§25).
- Placeholder pages use the localized EmptyState component — consistent "not yet" UX instead of blank screens (§29).

## 8. Component set

### 8.1 Vendored shadcn/ui (into `apps/web/src/components/ui/`)

button, input, textarea, select, label, card, badge, separator, dialog, sheet, tabs, dropdown-menu, tooltip, progress, skeleton, avatar, sonner (toast).

- Button variants: `default(primary) | secondary | outline | ghost | destructive` × sizes `sm | md | lg | icon`; styled with §8 tokens (moderate radius, subtle shadow, no pill-by-default).
- Badge variants: `default | success | warning | error | info | outline` (maps §8.2 semantics).
- All components: cva variants, `className` escape hatch, typed props, React 19 ref-as-prop pattern, **no hardcoded user-facing strings** (text via props or `common.json` defaults).

### 8.2 Custom state components (composed from primitives, localized defaults)

- `EmptyState` — icon slot, title, description, optional action.
- `LoadingState` — spinner and/or skeleton composition.
- `ErrorState` — message + retry action.

These are the §24 EmptyState/LoadingState/ErrorState primitives; §36 requires them on every feature screen later.

### 8.3 Showcase

`/:locale/style-guide` renders every component in every variant, token swatches, type scale, radius/shadow demos. The page itself is fully localized (doubles as an i18n demo) and is the standing surface for §40.7 visual QA. Accessible in all environments (contains no secrets).

## 9. Testing & QA

- **New web test stack:** vitest (environment jsdom) + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom. Root `pnpm test` picks up the web suite automatically (`pnpm -r test`).
- **Unit:** locale parity (en/tr key trees), `resolveLocale()` precedence chain, Intl format utils (en + tr), locale param validation/redirect behavior.
- **Component:** per-component smoke + key interactions — button variants/click, input typing/validation states, dialog open/close + focus management, tabs switching, dropdown keyboard navigation, toast trigger, sheet open (mobile), theme toggle mode cycling, language switcher route+cookie behavior. We test our integration (variants, strings, a11y attributes), not Radix internals.
- **Existing suites unchanged:** validation, worker (pool-workers) keep running in CI.
- **QA sweep (§40.7) on staging before prod dispatch:** desktop + mobile layouts; **Turkish text expansion** (nav labels, buttons); loading/empty/error states; dark mode; keyboard navigation + focus states; reduced-motion; style-guide pass in both locales.
- **CI:** unchanged shape (checks → staging auto → prod manual + smoke from Task 0).

## 10. Documentation

- `docs/localization.md`: namespace conventions, key style, resolution order, parity rule, how to add a string (en+tr together), AI locale context plan (§6.4).
- `docs/design-system.md`: token table (light/dark), typography, radius/shadow scale, component inventory + variant conventions, how to add a component (shadcn vendoring flow), showcase URL.
- `docs/architecture.md`: gains a frontend-architecture paragraph (router, i18n, theme) and updated layout tree.
- §44 doc list grows accordingly.

## 11. Delivery order

T0 chores → T1 tokens + theme (Inter, ThemeProvider, no-flash, motion rules) → T2 i18n foundation (setup, typed keys, parity test, format utils, resolveLocale) → T3 routing + locale redirect + placeholder pages + 404 → T4 AppShell (sidebar, bottom nav, switchers, plan-card placeholder) → T5 shadcn init + batch 1 (button, input, textarea, select, label, card, badge, separator) + tests → T6 batch 2 (dialog, sheet, tabs, dropdown-menu, tooltip, sonner) + tests → T7 batch 3 (progress, skeleton, avatar + EmptyState, LoadingState, ErrorState) + tests → T8 showcase `/style-guide` → T9 QA sweep + fixes → T10 deploy (staging auto; production via manual dispatch + CI smoke) + docs.

## 12. Risks & mitigations

| Risk                                                 | Mitigation                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| shadcn/Tailwind v4/React 19 version friction         | Pin the versions the CLI resolves; contingency: hand-vendor the affected component from its source               |
| TR text expansion breaks layouts                     | QA sweep item; nav/badges designed with flexible widths from the start                                           |
| Typed-keys augmentation fights i18next version churn | Augmentation isolated in one `i18n/types.d.ts`; parity test independent of types                                 |
| Dark mode contrast misses                            | Token pairs chosen per §8.3; style-guide swatches reviewed in both modes during QA sweep                         |
| Bundle growth (Radix + i18n JSON)                    | Static import only the initial namespaces; build output size checked at QA sweep; lazy-load threshold documented |
| Cookie/localStorage split-brain for locale           | Single writer module (`localePrefs`), cookie is authoritative for routing, storage mirrors for SSR-less reads    |

## 13. Definition of Done (Step 2)

- CI green on `main` including the new web test suites and the Task 0 deploy smokes.
- en/tr parity test green; no hardcoded user-facing strings in shell/components (review-verified).
- All §8.1–8.2 components exist with variants, tests, and appear on `/style-guide` in both locales.
- Light/dark/system theme works with no flash; reduced-motion respected.
- AppShell responsive: 240px sidebar desktop / bottom nav mobile per §9; keyboard + a11y pass.
- Locale routing: `/` redirect, invalid-locale redirect, switcher persists, `lang`/hreflang correct.
- Deployed to staging and production; production smoke green in CI.
- `docs/localization.md` + `docs/design-system.md` committed; architecture.md updated.
