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
  /**
   * HMAC secret for guest session cookies (§5 "signed" cookie). Provisioned via
   * `wrangler secret put` (dev/staging/production), `.dev.vars` locally and
   * miniflare bindings in tests — NEVER committed. Guest routes fail closed
   * (500 config_error) when missing or shorter than 32 chars.
   */
  GUEST_SESSION_SECRET?: string;
  /** Email provider selection: "log" (default, outbox-only) | "cloudflare" (dormant until domain verified — §47.4). */
  EMAIL_PROVIDER?: string;
  /** Transactional sender identity, e.g. noreply@learwizai.com (§47.12 — configuration, never hardcoded). */
  EMAIL_FROM_ADDRESS?: string;
  /** Base origin for email links (overrides per-environment defaults). */
  APP_ORIGIN?: string;
  /** PBKDF2 iteration count for password hashing (default 100000 — see spec D1 CPU note). */
  PASSWORD_HASH_ITERATIONS?: string;
  /** Workers AI inference binding (§13). */
  AI: Ai;
  /** §13.2 primary model — default @cf/zai-org/glm-4.7-flash. */
  AI_PRIMARY_MODEL?: string;
  /** §18 failover model — default @cf/meta/llama-3.1-8b-instruct-fast. */
  AI_FALLBACK_MODEL?: string;
  /** Test-only: canned per-model AI responses (deterministic CI, spec D10) — never set in deployed envs. */
  AI_MOCK_RESPONSES?: string;
}
