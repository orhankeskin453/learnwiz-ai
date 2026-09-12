import type { GuestSessionResponse } from "@learwizai/types";
import { apiClient } from "./apiClient";

const GUEST_SESSION_PATH = "/api/guest/session";

/**
 * Guest session access (CLAUDE.md §5): the SPA never touches the
 * `learwiz_guest_session` cookie (HttpOnly) — creation and status both go
 * through the API, which returns the authoritative remaining budgets.
 */
export function createGuestSession(): Promise<GuestSessionResponse> {
  return apiClient.post<GuestSessionResponse>(GUEST_SESSION_PATH);
}

export function getGuestSession(): Promise<GuestSessionResponse> {
  return apiClient.get<GuestSessionResponse>(GUEST_SESSION_PATH);
}
