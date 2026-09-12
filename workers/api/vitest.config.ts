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
              // Keep PBKDF2 fast in tests (min 10k enforced by passwordIterations).
              PASSWORD_HASH_ITERATIONS: "10000",
              // Deterministic AI (spec D10): keyed by model name — primary fails
              // once in this default so the router's fallback path is exercised.
              AI_MOCK_RESPONSES: JSON.stringify({
                // primary fails → router's single fallback attempt is exercised (§18)
                "mock-primary": { behavior: "fail" },
                "mock-fallback": {
                  behavior: "stream",
                  text: "Merhaba! Öğrenmeye başlayalım.",
                  usage: { prompt_tokens: 21, completion_tokens: 9 },
                },
              }),
              AI_PRIMARY_MODEL: "mock-primary",
              AI_FALLBACK_MODEL: "mock-fallback",
            },
          },
        },
      },
    },
  };
});
