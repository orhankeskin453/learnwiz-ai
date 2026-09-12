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
