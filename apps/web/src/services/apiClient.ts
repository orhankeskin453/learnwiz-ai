import type { ApiErrorCode, AuthErrorCode } from "@learwizai/types";

/** Typed fetch error carrying the machine-readable API error code (§23). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | AuthErrorCode | "network_error" | "unknown_error";

  constructor(status: number, code: ApiError["code"], message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Guest-session bootstrap (§4.1 "value before registration"): a first-time
 * visitor has no `learwiz_guest_session` cookie, so guest-capable endpoints
 * answer 401 `unauthenticated`. We create the session once and replay the
 * request, so every page works anonymously without its own retry logic.
 * Auth endpoints are excluded — there 401 simply means "not logged in".
 */
const GUEST_SESSION_PATH = "/api/guest/session";
const AUTH_PATH_PREFIX = "/api/auth/";

let bootstrap: Promise<void> | null = null;

function ensureGuestSession(): Promise<void> {
  // One in-flight bootstrap: parallel 401s must not create several sessions.
  bootstrap ??= fetch(GUEST_SESSION_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new ApiError(response.status, "unknown_error", "guest session bootstrap failed");
      }
    })
    .finally(() => {
      bootstrap = null;
    });
  return bootstrap;
}

async function request<T>(path: string, init?: RequestInit, allowGuestRetry = true): Promise<T> {
  let response: Response;
  try {
    // Same-origin deployment (Step 1): cookies flow by default; the guest
    // session cookie is HttpOnly and never read client-side.
    response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: { accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new ApiError(0, "network_error", cause instanceof Error ? cause.message : undefined);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const err = body as { error?: string; message?: string } | null;
    // Cast (not annotation) so `const` narrowing cannot drop the auth codes —
    // "unauthenticated" must stay comparable for the guest bootstrap below.
    const code = (err?.error ?? "unknown_error") as ApiError["code"];
    const guestCapable =
      allowGuestRetry && !path.startsWith(AUTH_PATH_PREFIX) && path !== GUEST_SESSION_PATH;
    if (response.status === 401 && code === "unauthenticated" && guestCapable) {
      await ensureGuestSession();
      return request<T>(path, init, false);
    }
    throw new ApiError(response.status, code, err?.message);
  }
  return body as T;
}

/** Typed same-origin API client (CLAUDE.md §7 "typed API clients"). */
export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" }),
  post: <T>(path: string, init?: RequestInit): Promise<T> =>
    request<T>(path, { method: "POST", ...init }),
};
