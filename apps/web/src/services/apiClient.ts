import type { ApiErrorCode, ApiErrorBody, AuthErrorCode } from "@learwizai/types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    const err = body as Partial<ApiErrorBody> | null;
    throw new ApiError(response.status, err?.error ?? "unknown_error", err?.message);
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
