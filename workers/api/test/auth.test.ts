import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, AuthSessionResponse, GenericAuthResponse } from "@learwizai/types";
import { createAuthToken } from "../src/services/tokens";

const BASE = "http://local/api/auth";
const IP = { "CF-Connecting-IP": "192.0.2.50" };
const PASSWORD = "correct-horse-battery";

function cookieFrom(res: Response, name: string): string | null {
  const match = res.headers.get("set-cookie")?.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1]! : null;
}

function sessionCookieHeader(token: string): string {
  return `learwiz_session=${token}`;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Register through the API, then mint a verifiable token via the service. */
async function registerAndMintToken(email: string): Promise<{ userId: string; token: string }> {
  const res = await SELF.fetch(`${BASE}/register`, {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(201);
  const { env } = await import("cloudflare:test");
  const userRow = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?")
    .bind(email)
    .first<{ id: string }>();
  expect(userRow).not.toBeNull();
  const { token } = await createAuthToken(env.DB, userRow!.id, "email_verification");
  return { userId: userRow!.id, token };
}

describe("POST /api/auth/register", () => {
  beforeEach(async () => {
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("creates a pending user, queues a localized verification email and audits", async () => {
    const res = await SELF.fetch(`${BASE}/register`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "Ada@Example.com", password: PASSWORD }),
    });
    expect(res.status).toBe(201);
    const body = await jsonBody<GenericAuthResponse>(res);
    expect(body).toEqual({ ok: true }); // no user id, no token — anti-enumeration shape

    const { env } = await import("cloudflare:test");
    const user = await env.DB.prepare(
      "SELECT status, email_verified_at, email FROM users WHERE email_normalized = ?",
    )
      .bind("ada@example.com")
      .first<{ status: string; email_verified_at: string | null; email: string }>();
    expect(user?.status).toBe("pending");
    expect(user?.email_verified_at).toBeNull();
    // The validation schema normalizes emails (trim + lowercase) — display and
    // lookup share one canonical form.
    expect(user?.email).toBe("ada@example.com");

    const emailEvent = await env.DB.prepare(
      "SELECT event_type, status, locale FROM email_events ORDER BY created_at DESC LIMIT 1",
    ).first<{ event_type: string; status: string; locale: string }>();
    expect(emailEvent).toMatchObject({ event_type: "verification", status: "sent", locale: "en" });

    const audits = await env.DB.prepare("SELECT action FROM audit_events").all<{
      action: string;
    }>();
    const auditActions = audits.results.map((r) => r.action);
    expect(auditActions).toContain("signup_started");
    expect(auditActions).toContain("email_verification_sent");
  });

  it("responds identically for duplicate emails WITHOUT side effects", async () => {
    const first = await SELF.fetch(`${BASE}/register`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "dupe@example.com", password: PASSWORD }),
    });
    expect(first.status).toBe(201);
    const { env } = await import("cloudflare:test");
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM email_events").first<{
      n: number;
    }>();

    const second = await SELF.fetch(`${BASE}/register`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "dupe@example.com", password: "another-password-1" }),
    });
    expect(second.status).toBe(201);
    expect(await jsonBody<GenericAuthResponse>(second)).toEqual({ ok: true });

    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM email_events").first<{
      n: number;
    }>();
    expect(after?.n).toBe(before?.n); // no email for duplicate
  });

  it("rejects weak passwords and malformed emails", async () => {
    const res = await SELF.fetch(`${BASE}/register`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "weak@example.com", password: "short" }),
    });
    expect(res.status).toBe(400);
    const body = await jsonBody<ApiErrorBody>(res);
    expect(body.error).toBe("validation_error");
  });

  it("throttles the 6th registration from one IP per hour", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await SELF.fetch(`${BASE}/register`, {
        method: "POST",
        headers: { ...IP, "content-type": "application/json" },
        body: JSON.stringify({ email: `user${i}@example.com`, password: PASSWORD }),
      });
      expect(res.status).toBe(201);
    }
    const sixth = await SELF.fetch(`${BASE}/register`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "user5@example.com", password: PASSWORD }),
    });
    expect(sixth.status).toBe(429);
  });
});

describe("email verification + session lifecycle", () => {
  beforeEach(async () => {
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("verifies, activates, sets a session cookie and migrates an attached guest session", async () => {
    // Guest session first (Step 3 cookie), attached to the verification call.
    const guestRes = await SELF.fetch("http://local/api/guest/session", {
      method: "POST",
      headers: IP,
    });
    const guestCookie = cookieFrom(guestRes, "learwiz_guest_session");
    expect(guestCookie).not.toBeNull();

    const { token } = await registerAndMintToken("migrate@example.com");
    const res = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = await jsonBody<AuthSessionResponse>(res);
    expect(body.user.status).toBe("active");
    expect(body.user.emailVerified).toBe(true);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=2592000");

    // Guest session marked migrated (§5.2 hook).
    const { env } = await import("cloudflare:test");
    const guestRow = await env.DB.prepare(
      "SELECT migration_status FROM guest_sessions ORDER BY created_at DESC LIMIT 1",
    ).first<{ migration_status: string }>();
    expect(guestRow?.migration_status).toBe("migrated");

    // Welcome email queued.
    const welcome = await env.DB.prepare(
      "SELECT event_type FROM email_events WHERE event_type = 'welcome'",
    ).first<{ event_type: string }>();
    expect(welcome?.event_type).toBe("welcome");
  });

  it("rejects expired verification tokens", async () => {
    const { token } = await registerAndMintToken("expired@example.com");
    const { env } = await import("cloudflare:test");
    await env.DB.prepare(
      "UPDATE auth_tokens SET expires_at = ? WHERE token_hash IN (SELECT token_hash FROM auth_tokens)",
    )
      .bind(new Date(Date.now() - 1000).toISOString())
      .run();
    const res = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody<ApiErrorBody>(res)).error).toBe("invalid_token");
  });

  it("rejects reused (already consumed) tokens", async () => {
    const { token } = await registerAndMintToken("reuse@example.com");
    const first = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(first.status).toBe(200);
    const second = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(second.status).toBe(400);
  });
});

describe("login / logout / me", () => {
  let email: string;
  let token: string;

  beforeEach(async () => {
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("DELETE FROM users").run();
    email = `login${Math.floor(Math.random() * 1e9)}@example.com`;
    ({ token } = await registerAndMintToken(email));
  });

  it("blocks unverified accounts with a distinct error", async () => {
    const res = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(403);
    expect((await jsonBody<ApiErrorBody>(res)).error).toBe("email_not_verified");
  });

  it("logs in a verified user, then me and logout work", async () => {
    await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const login = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(login.status).toBe(200);
    const sessionCookie = cookieFrom(login, "learwiz_session");
    expect(sessionCookie).not.toBeNull();

    const me = await SELF.fetch(`${BASE}/me`, {
      headers: { ...IP, cookie: sessionCookieHeader(sessionCookie!) },
    });
    expect(me.status).toBe(200);
    const profile = await jsonBody<AuthSessionResponse["user"]>(me);
    expect(profile.email).toBe(email);
    expect(profile.emailVerified).toBe(true);

    const logout = await SELF.fetch(`${BASE}/logout`, {
      method: "POST",
      headers: { ...IP, cookie: sessionCookieHeader(sessionCookie!) },
    });
    expect(logout.status).toBe(204);

    const meAfter = await SELF.fetch(`${BASE}/me`, {
      headers: { ...IP, cookie: sessionCookieHeader(sessionCookie!) },
    });
    expect(meAfter.status).toBe(401); // server-side revocation, not just cookie clearing
  });

  it("returns identical 401s for wrong password and unknown email", async () => {
    await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const wrongPassword = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: "totally-wrong-pass" }),
    });
    const unknown = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: PASSWORD }),
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknown.json());
  });

  it("rejects suspended accounts at login AND via existing sessions", async () => {
    const verify = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const sessionCookie = cookieFrom(verify, "learwiz_session")!;

    const { env } = await import("cloudflare:test");
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email_normalized = ?")
      .bind(email)
      .run();

    const login = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(login.status).toBe(403);
    expect((await jsonBody<ApiErrorBody>(login)).error).toBe("account_suspended");

    // Valid session cookie, suspended account → anonymous (§40.8).
    const me = await SELF.fetch(`${BASE}/me`, {
      headers: { ...IP, cookie: sessionCookieHeader(sessionCookie) },
    });
    expect(me.status).toBe(401);
  });
});

describe("password reset flow", () => {
  let email: string;
  let token: string;

  beforeEach(async () => {
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("DELETE FROM users").run();
    email = `reset${Math.floor(Math.random() * 1e9)}@example.com`;
    ({ token } = await registerAndMintToken(email));
    await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  });

  it("requests generically, resets, and revokes ALL sessions", async () => {
    const login = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const oldSession = cookieFrom(login, "learwiz_session")!;

    // Request via API (response generic), then mint a usable token via service.
    const request = await SELF.fetch(`${BASE}/request-password-reset`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(request.status).toBe(200);
    expect(await jsonBody<GenericAuthResponse>(request)).toEqual({ ok: true });

    // Unknown email: same generic response (§40.9).
    const unknown = await SELF.fetch(`${BASE}/request-password-reset`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "ghost@example.com" }),
    });
    expect(await unknown.json()).toEqual({ ok: true });

    const { env } = await import("cloudflare:test");
    const userId = (await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?")
      .bind(email)
      .first<{ id: string }>())!.id;
    const { token: resetToken } = await createAuthToken(env.DB, userId, "password_reset");

    const confirm = await SELF.fetch(`${BASE}/reset-password`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "brand-new-password-1" }),
    });
    expect(confirm.status).toBe(200);

    // Old password rejected, new password accepted, ALL sessions revoked.
    const oldLogin = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: "brand-new-password-1" }),
    });
    expect(newLogin.status).toBe(200);

    const me = await SELF.fetch(`${BASE}/me`, {
      headers: { ...IP, cookie: sessionCookieHeader(oldSession) },
    });
    expect(me.status).toBe(401); // pre-reset session is dead (§40.4 revoke-all)
  });

  it("rejects reset with an invalid token", async () => {
    const res = await SELF.fetch(`${BASE}/reset-password`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token: "f".repeat(64), password: "brand-new-password-1" }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody<ApiErrorBody>(res)).error).toBe("invalid_token");
  });
});

describe("guest usage of auth endpoints", () => {
  it("401s unauthenticated me and logout", async () => {
    const me = await SELF.fetch(`${BASE}/me`, { headers: IP });
    expect(me.status).toBe(401);
    const logout = await SELF.fetch(`${BASE}/logout`, { method: "POST", headers: IP });
    expect(logout.status).toBe(401);
  });
});

describe("token purpose separation + resend (§40.9)", () => {
  beforeEach(async () => {
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("DELETE FROM users").run();
  });

  it("rejects a password_reset token submitted as email verification (purpose mismatch)", async () => {
    const email = "purpose@example.com";
    const { userId } = await registerAndMintToken(email);
    const { env } = await import("cloudflare:test");
    const { token: resetToken } = await createAuthToken(env.DB, userId, "password_reset");

    const res = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody<ApiErrorBody>(res)).error).toBe("invalid_token");
  });

  it("resend-verification responds generically and invalidates the earlier token", async () => {
    const email = "resend@example.com";
    const { token: firstToken } = await registerAndMintToken(email);

    const resend = await SELF.fetch(`${BASE}/resend-verification`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(resend.status).toBe(200);
    expect(await jsonBody<GenericAuthResponse>(resend)).toEqual({ ok: true });

    // Unknown email: identical generic response (§40.9).
    const unknown = await SELF.fetch(`${BASE}/resend-verification`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "ghost@example.com" }),
    });
    expect(await unknown.json()).toEqual({ ok: true });

    // Re-issue consumed the earlier outstanding token — firstToken must fail now.
    const verifyOld = await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token: firstToken }),
    });
    expect(verifyOld.status).toBe(400);
    expect((await jsonBody<ApiErrorBody>(verifyOld)).error).toBe("invalid_token");
  });

  it("audits signup_completed, email_verified and guest_migration_completed on verification", async () => {
    const guestRes = await SELF.fetch("http://local/api/guest/session", {
      method: "POST",
      headers: IP,
    });
    const guestCookie = cookieFrom(guestRes, "learwiz_guest_session")!;
    const { token } = await registerAndMintToken("audits@example.com");

    await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ token }),
    });

    const { env } = await import("cloudflare:test");
    const actions = await env.DB.prepare("SELECT action FROM audit_events").all<{
      action: string;
    }>();
    const written = actions.results.map((r) => r.action);
    expect(written).toContain("email_verified");
    expect(written).toContain("signup_completed");
    expect(written).toContain("guest_migration_completed");
    expect(written).toContain("email_verification_sent");
  });

  it("throttles the 11th login attempt for one IP+email", async () => {
    const email = "throttle@example.com";
    const { token } = await registerAndMintToken(email);
    await SELF.fetch(`${BASE}/verify-email`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    let last: Response | undefined;
    for (let i = 0; i < 10; i++) {
      last = await SELF.fetch(`${BASE}/login`, {
        method: "POST",
        headers: { ...IP, "content-type": "application/json" },
        body: JSON.stringify({ email, password: PASSWORD }),
      });
      expect(last.status).toBe(200);
    }
    const eleventh = await SELF.fetch(`${BASE}/login`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(eleventh.status).toBe(429);
  });
});
