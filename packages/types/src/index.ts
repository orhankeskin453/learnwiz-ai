/** Locales supported at launch (CLAUDE.md §6). English is the fallback. */
export type Locale = "en" | "tr";

/** Response body of GET /api/health (CLAUDE.md Step 1 foundation). */
export interface HealthResponse {
  status: "ok";
  service: "learwizai-api";
  environment: string;
  timestamp: string;
  checks: {
    db: "ok" | "unavailable";
  };
}
