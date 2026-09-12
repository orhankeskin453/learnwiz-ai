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

/** Guest-feature capabilities gated by entitlements (CLAUDE.md §5.1, §17). */
export type Feature = "ai_tutor" | "learn_mode" | "practice" | "quiz";

/** Per-feature usage snapshot for an identity. Limits are server-authoritative. */
export interface FeatureUsage {
  feature: Feature;
  used: number;
  /** Max uses allowed for this identity/session; 0 means unavailable. */
  limit: number;
}

/** Response body of POST/GET /api/guest/session (CLAUDE.md §5, §22). */
export interface GuestSessionResponse {
  /** ISO-8601 UTC instant — when the guest session expires (fixed 7-day window). */
  expiresAt: string;
  usage: FeatureUsage[];
}

/** Machine-readable API error codes (envelope: `{ error, message? }`). */
export type ApiErrorCode =
  | "not_found"
  | "guest_session_not_found"
  | "guest_session_invalid"
  | "rate_limited"
  | "config_error"
  | "internal_error";

export interface ApiErrorBody {
  error: ApiErrorCode;
  message?: string;
}

/** User profile exposed by GET /api/auth/me — never includes credentials. */
export interface UserProfile {
  id: string;
  email: string;
  locale: Locale;
  status: "pending" | "active" | "suspended" | "deleted";
  emailVerified: boolean;
  createdAt: string;
}

/** Body of POST /api/auth/login|verify-email (session created). */
export interface AuthSessionResponse {
  user: UserProfile;
}

/** Generic anti-enumeration body for register / password-reset requests (§40.9). */
export interface GenericAuthResponse {
  ok: true;
}

/** Additional machine-readable auth error codes (envelope: `{ error, message? }`). */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_verified"
  | "account_suspended"
  | "validation_error"
  | "unauthenticated"
  | "invalid_token";
