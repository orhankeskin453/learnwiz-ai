import "cloudflare:test";
import type { Env } from "../src/env";

// Augment the pool-workers provided env with the worker's bindings plus the
// TEST_MIGRATIONS binding injected in vitest.config.ts (readD1Migrations recipe).
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
