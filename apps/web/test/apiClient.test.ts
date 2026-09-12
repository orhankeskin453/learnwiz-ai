import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/services/apiClient";
import { createGuestSession, getGuestSession } from "@/services/guestSessions";

const okBody = {
  expiresAt: "2026-09-19T12:00:00.000Z",
  usage: [{ feature: "ai_tutor", used: 1, limit: 3 }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends same-origin JSON requests and parses typed bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    vi.stubGlobal("fetch", fetchMock);

    const body = await getGuestSession();

    expect(fetchMock).toHaveBeenCalledWith("/api/guest/session", expect.anything());
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBeUndefined(); // default GET
    expect(init.credentials).toBe("same-origin");
    expect(body).toEqual(okBody);
  });

  it("POSTs to the guest session endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, okBody));
    vi.stubGlobal("fetch", fetchMock);

    await createGuestSession();

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("maps API error envelopes to ApiError with the machine code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "guest_session_invalid" })),
    );

    const err = await getGuestSession().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(401);
    expect(apiError.code).toBe("guest_session_invalid");
  });

  it("falls back to unknown_error when the error body is not the standard envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { unexpected: true })));

    const err = await createGuestSession().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("unknown_error");
  });

  it("wraps network failures as network_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const err = await apiClient.get("/api/anything").catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("network_error");
  });
});
