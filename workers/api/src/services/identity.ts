/**
 * Request identity for API routes (CLAUDE.md §22 middleware order, §33).
 *
 * `guest` carries a verified, server-side session id. `anonymous` means the
 * request has no usable identity yet — guest-feature routes treat it as
 * "session must be created first". The `user` variant arrives with the auth
 * step (§48 item 6) and plugs into the same union.
 */
export type Identity = { kind: "guest"; sessionId: string } | { kind: "anonymous" };

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
