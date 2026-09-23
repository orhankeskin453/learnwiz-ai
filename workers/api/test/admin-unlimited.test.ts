import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChatResponse, QuotaState } from "@learwizai/types";
import { createAuthToken } from "../src/services/tokens";

const IP = { "CF-Connecting-IP": "198.51.100.90" };

/** Register + verify a user; optionally grant the admin role (unlimited). */
async function createUserSession(email: string, admin = false): Promise<string> {
  const register = await SELF.fetch("http://local/api/auth/register", {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery" }),
  });
  expect(register.status).toBe(201);
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?")
    .bind(email)
    .first<{ id: string }>();
  if (admin) {
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user!.id).run();
  }
  const { token } = await createAuthToken(env.DB, user!.id, "email_verification");
  const verify = await SELF.fetch("http://local/api/auth/verify-email", {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  expect(verify.status).toBe(200);
  const match = verify.headers.get("set-cookie")?.match(/learwiz_session=([^;]+)/);
  if (!match) throw new Error("no session cookie");
  return match[1]!;
}

function sessionHeaders(cookie: string): Record<string, string> {
  return { ...IP, "content-type": "application/json", cookie: `learwiz_session=${cookie}` };
}

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4 admin unlimited fixture");
}

async function upload(cookie: string): Promise<Response> {
  return SELF.fetch("http://local/api/documents?locale=en&filename=a.pdf", {
    method: "POST",
    headers: { ...IP, "content-type": "application/pdf", cookie: `learwiz_session=${cookie}` },
    body: pdfBytes(),
  });
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM documents").run();
  await env.DB.prepare("DELETE FROM conversations").run();
});

describe("admin accounts are unlimited (testing access)", () => {
  it("admin bypasses the daily AI limit; a regular user hits it", async () => {
    const admin = await createUserSession("admin@example.com", true);
    const member = await createUserSession("member@example.com", false);

    // Regular user stops at 10 (Free daily pool).
    for (let i = 0; i < 10; i++) {
      const res = await SELF.fetch("http://local/api/tutor/chat", {
        method: "POST",
        headers: sessionHeaders(member),
        body: JSON.stringify({ message: `Q${i}`, locale: "en" }),
      });
      expect(res.status).toBe(200);
    }
    const blocked = await SELF.fetch("http://local/api/tutor/chat", {
      method: "POST",
      headers: sessionHeaders(member),
      body: JSON.stringify({ message: "one more", locale: "en" }),
    });
    expect(blocked.status).toBe(403);

    // Admin sails past the same threshold.
    for (let i = 0; i < 12; i++) {
      const res = await SELF.fetch("http://local/api/tutor/chat", {
        method: "POST",
        headers: sessionHeaders(admin),
        body: JSON.stringify({ message: `A${i}`, locale: "en" }),
      });
      expect(res.status).toBe(200);
    }

    // Ledger records admin usage at the top tier (no CHECK violations).
    const row = await env.DB.prepare(
      "SELECT plan FROM ai_usage WHERE user_id = (SELECT id FROM users WHERE email_normalized = 'admin@example.com') ORDER BY created_at DESC LIMIT 1",
    ).first<{ plan: string }>();
    expect(row?.plan).toBe("pro");
  });

  it("admin quota endpoint reports unlimited; page hides the hint", async () => {
    const admin = await createUserSession("adminq@example.com", true);
    const res = await SELF.fetch("http://local/api/tutor/quota", {
      headers: sessionHeaders(admin),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as QuotaState;
    expect(body.unlimited).toBe(true);
  });

  it("admin bypasses the document limit (regular user stops at 2)", async () => {
    const member = await createUserSession("docmember@example.com", false);
    expect((await upload(member)).status).toBe(201);
    expect((await upload(member)).status).toBe(201);
    const third = await upload(member);
    expect(third.status).toBe(403);

    const admin = await createUserSession("docadmin@example.com", true);
    for (let i = 0; i < 4; i++) {
      expect((await upload(admin)).status).toBe(201);
    }
  });

  it("administrator can generate lessons past the shared pool (learn path)", async () => {
    const admin = await createUserSession("learnadmin@example.com", true);
    for (let i = 0; i < 12; i++) {
      const res = await SELF.fetch("http://local/api/learn/lessons", {
        method: "POST",
        headers: sessionHeaders(admin),
        body: JSON.stringify({ topic: `Topic ${i}`, locale: "en" }),
      });
      expect(res.status).toBe(200);
    }
  });
});

// Keep ChatResponse referenced for type-level contract checks in this file.
export type { ChatResponse };

describe("ADMIN_EMAILS bootstrap allowlist (§40.6)", () => {
  it("promotes a listed email to admin at registration (unlimited immediately)", async () => {
    const cookie = await createUserSession("boot-admin@example.com", false);
    const row = await env.DB.prepare(
      "SELECT role FROM users WHERE email_normalized = 'boot-admin@example.com'",
    ).first<{ role: string }>();
    expect(row?.role).toBe("admin");

    const quota = await SELF.fetch("http://local/api/tutor/quota", {
      headers: sessionHeaders(cookie),
    });
    const body = (await quota.json()) as QuotaState;
    expect(body.unlimited).toBe(true);
  });

  it("leaves unlisted emails as regular users", async () => {
    await createUserSession("not-listed@example.com", false);
    const row = await env.DB.prepare(
      "SELECT role FROM users WHERE email_normalized = 'not-listed@example.com'",
    ).first<{ role: string }>();
    expect(row?.role).toBe("user");
  });
});

describe("bootstrap admins skip email verification (§40.6 testing access)", () => {
  it("a listed email is active + admin immediately after registration", async () => {
    const res = await SELF.fetch("http://local/api/auth/register", {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "boot-admin@example.com", password: "correct-horse-battery" }),
    });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare(
      "SELECT role, status, email_verified_at FROM users WHERE email_normalized = 'boot-admin@example.com'",
    ).first<{ role: string; status: string; email_verified_at: string | null }>();
    expect(row?.role).toBe("admin");
    expect(row?.status).toBe("active");
    expect(row?.email_verified_at).not.toBeNull();

    // And login works right away — no verification email needed.
    const login = await SELF.fetch("http://local/api/auth/login", {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "boot-admin@example.com", password: "correct-horse-battery" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.match(/learwiz_session=([^;]+)/)?.[1] ?? "";
    const quota = await SELF.fetch("http://local/api/tutor/quota", {
      headers: { ...IP, cookie: `learwiz_session=${cookie}` },
    });
    expect(((await quota.json()) as QuotaState).unlimited).toBe(true);
  });

  it("regular users still need verification", async () => {
    await SELF.fetch("http://local/api/auth/register", {
      method: "POST",
      headers: { ...IP, "content-type": "application/json" },
      body: JSON.stringify({ email: "normal@example.com", password: "correct-horse-battery" }),
    });
    const row = await env.DB.prepare(
      "SELECT role, status FROM users WHERE email_normalized = 'normal@example.com'",
    ).first<{ role: string; status: string }>();
    expect(row).toEqual({ role: "user", status: "pending" });
  });
});

describe("quota scope labelling (§5.1 vs §10.10)", () => {
  it("reports guest quota as a per-session scope and user quota as daily", async () => {
    const guestRes = await SELF.fetch("http://local/api/guest/session", {
      method: "POST",
      headers: { "CF-Connecting-IP": "198.51.100.91" },
    });
    const guestCookie =
      guestRes.headers.get("set-cookie")?.match(/learwiz_guest_session=([^;]+)/)?.[1] ?? "";
    expect(guestCookie).not.toBe("");
    const guestQuota = await SELF.fetch("http://local/api/tutor/quota", {
      headers: {
        "CF-Connecting-IP": "198.51.100.91",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
    });
    expect(await guestQuota.json()).toMatchObject({ limit: 3, scope: "session" });

    const user = await createUserSession("scope-user@example.com");
    const userQuota = await SELF.fetch("http://local/api/tutor/quota", {
      headers: {
        "CF-Connecting-IP": "198.51.100.91",
        "content-type": "application/json",
        cookie: `learwiz_session=${user}`,
      },
    });
    expect(await userQuota.json()).toMatchObject({ limit: 10, scope: "daily" });
  });
});
