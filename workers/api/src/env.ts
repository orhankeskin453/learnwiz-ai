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
