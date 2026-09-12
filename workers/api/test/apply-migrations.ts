import { applyD1Migrations, env } from "cloudflare:test";

// Applies all migrations in TEST_MIGRATIONS (injected by vitest.config.ts via
// readD1Migrations) to the local miniflare D1 before any test runs.
// Remote databases are NEVER touched from tests (README rule).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
