import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  // Read migration files at config time and inject them as a test binding so
  // test/apply-migrations.ts can apply them to the LOCAL miniflare D1.
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "../../db/migrations"));

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              // Top-level wrangler.jsonc sets ENVIRONMENT=production; tests run
              // as a local env so cookie Secure-flag behavior matches local dev.
              ENVIRONMENT: "test",
              // Local-only test secret (≥32 chars); production uses `wrangler secret put`.
              GUEST_SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
            },
          },
        },
      },
    },
  };
});
