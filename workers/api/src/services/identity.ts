/**
 * Request identity for API routes (CLAUDE.md §22 middleware order, §33/§40.2).
 *
 * Precedence: authenticated session > guest session > anonymous. The
 * authenticated variant resolves only ACTIVE accounts — suspended/deleted
 * users fall back to anonymous even with a valid session (§40.8).
 */
export type Identity =
  | { kind: "guest"; sessionId: string }
  | { kind: "user"; userId: string; sessionId: string }
  | { kind: "anonymous" };

/** Thrown when a route requires a usable identity but none is present. */
export class IdentityError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: 401 | 404, code: "guest_session_invalid" | "guest_session_not_found") {
    super(code);
    this.name = "IdentityError";
    this.status = status;
    this.code = code;
  }
}

/** Thrown when a required runtime configuration value is missing or unsafe. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
