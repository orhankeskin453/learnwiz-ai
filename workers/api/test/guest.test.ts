import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, GuestSessionResponse } from "@learwizai/types";

const BASE = "http://local/api/guest/session";
const IP_HEADERS = { "CF-Connecting-IP": "198.51.100.7" };

function cookieValueFrom(setCookie: string | null): string {
  const match = setCookie?.match(/learwiz_guest_session=([^;]+)/);
  expect(match).not.toBeNull();
  return match![1]!;
}

async function createGuestSession(
  ip = IP_HEADERS,
): Promise<{ res: Response; body: GuestSessionResponse; cookie: string }> {
  const res = await SELF.fetch(BASE, { method: "POST", headers: ip });
  const body = (await res.json()) as GuestSessionResponse;
  const cookie = res.headers.get("set-cookie");
  return { res, body, cookie: cookie ? cookieValueFrom(cookie) : "" };
}

describe("POST /api/guest/session", () => {
  it("creates a session with §5.1 budgets and the hardened cookie attributes", async () => {
    const { res, body, cookie } = await createGuestSession();

    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(res.headers.get("set-cookie")).toContain("Path=/");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=604800");
    // wrangler dev / tests serve plain HTTP — Secure must be OFF locally.
    expect(res.headers.get("set-cookie")).not.toContain("Secure");

    const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(expectedExpiry - 60_000);
    expect(Date.parse(body.expiresAt)).toBeLessThan(expectedExpiry + 60_000);
    expect(body.usage).toEqual([
      { feature: "ai_tutor", used: 0, limit: 3 },
      { feature: "learn_mode", used: 0, limit: 1 },
      { feature: "practice", used: 0, limit: 3 },
      { feature: "quiz", used: 0, limit: 1 },
    ]);
    // The raw session id must never be echoed in a response body.
    expect(JSON.stringify(body)).not.toContain(cookie.split(".")[0]);
  });

  it("is idempotent — a valid cookie reuses the same session (200, no new cookie)", async () => {
    const first = await createGuestSession();
    const second = await SELF.fetch(BASE, {
      method: "POST",
      headers: { ...IP_HEADERS, cookie: `learwiz_guest_session=${first.cookie}` },
    });
    expect(second.status).toBe(200);
    const body = (await second.json()) as GuestSessionResponse;
    expect(body.expiresAt).toBe(first.body.expiresAt);
    expect(second.headers.get("set-cookie")).toBeNull();
  });

  it("recovers with a NEW session when the presented cookie is tampered", async () => {
    const first = await createGuestSession();
    const tampered = `${first.cookie.slice(0, -2)}ff`;

    const second = await SELF.fetch(BASE, {
      method: "POST",
      headers: { ...IP_HEADERS, cookie: `learwiz_guest_session=${tampered}` },
    });
    expect(second.status).toBe(201);
    expect(second.headers.get("set-cookie")).not.toBeNull();
    const newCookie = cookieValueFrom(second.headers.get("set-cookie"));
    expect(newCookie).not.toBe(first.cookie);
  });
});

describe("GET /api/guest/session", () => {
  it("returns 404 with the machine error code when no cookie is present", async () => {
    const res = await SELF.fetch(BASE, { headers: IP_HEADERS });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error).toBe("guest_session_not_found");
  });

  it("returns 401 for a tampered cookie", async () => {
    const first = await createGuestSession();
    const res = await SELF.fetch(BASE, {
      headers: {
        ...IP_HEADERS,
        cookie: `learwiz_guest_session=${first.cookie.slice(0, -2)}ff`,
      },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error).toBe("guest_session_invalid");
  });

  it("returns 401 once the session is expired in D1", async () => {
    const { cookie } = await createGuestSession();
    const cookieId = cookie.split(".")[0];

    // Fast-forward expiry directly through the test D1 binding.
    const update = await SELF.fetch("http://local/api/health"); // sanity: worker up
    expect(update.status).toBe(200);
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("UPDATE guest_sessions SET expires_at = ? WHERE id = ?")
      .bind(new Date(Date.now() - 1000).toISOString(), cookieId)
      .run();

    const res = await SELF.fetch(BASE, {
      headers: { ...IP_HEADERS, cookie: `learwiz_guest_session=${cookie}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error).toBe("guest_session_invalid");
  });

  it("returns 401 once the session is marked migrated (§5.2)", async () => {
    const { cookie } = await createGuestSession();
    const cookieId = cookie.split(".")[0]!;
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("UPDATE guest_sessions SET migration_status = 'migrated' WHERE id = ?")
      .bind(cookieId)
      .run();

    const res = await SELF.fetch(BASE, {
      headers: { ...IP_HEADERS, cookie: `learwiz_guest_session=${cookie}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error).toBe("guest_session_invalid");
  });

  it("echoes a correlation id (X-Request-Id) for log tracing (§22)", async () => {
    const res = await SELF.fetch(BASE, { headers: IP_HEADERS });
    expect(res.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns the current status with the same budgets for a valid session", async () => {
    const { cookie, body: created } = await createGuestSession();
    const res = await SELF.fetch(BASE, {
      headers: { ...IP_HEADERS, cookie: `learwiz_guest_session=${cookie}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuestSessionResponse;
    expect(body).toEqual(created);
  });
});

describe("rate limiting (§18)", () => {
  it("throttles the 21st creation from the same IP within the window", async () => {
    const ip = { "CF-Connecting-IP": "203.0.113.77" };
    let last: Response | undefined;
    for (let i = 0; i < 20; i++) {
      last = await SELF.fetch(BASE, { method: "POST", headers: ip });
      expect(last.status).toBe(201);
    }
    const blocked = await SELF.fetch(BASE, { method: "POST", headers: ip });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as ApiErrorBody;
    expect(body.error).toBe("rate_limited");
    expect(Number.parseInt(blocked.headers.get("retry-after") ?? "0", 10)).toBeGreaterThan(0);

    // A different IP is unaffected.
    const otherIp = await SELF.fetch(BASE, {
      method: "POST",
      headers: { "CF-Connecting-IP": "198.51.100.99" },
    });
    expect(otherIp.status).toBe(201);
  });
});
