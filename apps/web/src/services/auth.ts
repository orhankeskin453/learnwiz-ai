import type { AuthSessionResponse, GenericAuthResponse, UserProfile } from "@learwizai/types";
import { apiClient } from "./apiClient";

/** Auth API wrappers (CLAUDE.md §47.2) — server remains the validation authority. */

export function register(email: string, password: string): Promise<GenericAuthResponse> {
  return apiClient.post<GenericAuthResponse>("/api/auth/register", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthSessionResponse> {
  return apiClient.post<AuthSessionResponse>("/api/auth/login", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiClient.post<void>("/api/auth/logout");
}

export async function me(): Promise<UserProfile | null> {
  try {
    return await apiClient.get<UserProfile>("/api/auth/me");
  } catch {
    return null; // unauthenticated — a normal state for guests
  }
}

export function verifyEmail(token: string): Promise<AuthSessionResponse> {
  return apiClient.post<AuthSessionResponse>("/api/auth/verify-email", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string): Promise<GenericAuthResponse> {
  return apiClient.post<GenericAuthResponse>("/api/auth/resend-verification", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(email: string): Promise<GenericAuthResponse> {
  return apiClient.post<GenericAuthResponse>("/api/auth/request-password-reset", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string): Promise<GenericAuthResponse> {
  return apiClient.post<GenericAuthResponse>("/api/auth/reset-password", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
}
