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
