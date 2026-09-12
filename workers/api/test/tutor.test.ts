import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, ChatResponse, ConversationDetail } from "@learwizai/types";
import { createAuthToken } from "../src/services/tokens";

const CHAT = "http://local/api/tutor/chat";
const IP = { "CF-Connecting-IP": "198.51.100.30" };

async function createGuest(): Promise<string> {
  const res = await SELF.fetch("http://local/api/guest/session", { method: "POST", headers: IP });
  const match = res.headers.get("set-cookie")?.match(/learwiz_guest_session=([^;]+)/);
  if (!match) throw new Error("no guest cookie");
  return match[1]!;
}

async function createUserSession(email: string): Promise<string> {
  const register = await SELF.fetch("http://local/api/auth/register", {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery" }),
  });
  expect(register.status).toBe(201);
  const { env } = await import("cloudflare:test");
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?")
    .bind(email)
    .first<{ id: string }>();
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

async function chat(
  cookie: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  return SELF.fetch(CHAT, {
    method: "POST",
    headers: { ...IP, "content-type": "application/json", cookie },
    body: JSON.stringify({ message, locale: "tr", ...extra }),
  });
}

function json(res: Response): Promise<ApiErrorBody> {
  return res.json() as Promise<ApiErrorBody>;
}

beforeEach(async () => {
  const { env } = await import("cloudflare:test");
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM conversations").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
});

describe("POST /api/tutor/chat (guest)", () => {
  it("answers, records exact §13.6 usage and decrements the guest quota", async () => {
    const guestCookie = await createGuest();

    const res = await chat(`learwiz_guest_session=${guestCookie}`, "Fotokimya nedir?");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ChatResponse;
    // The primary mock fails → the router's single §18 fallback serves the answer.
    expect(body.usage.fallback).toBe(true);
    expect(body.assistantMessage).toContain("Öğrenmeye başlayalım");
    expect(body.usage).toMatchObject({ inputTokens: 21, outputTokens: 9 });
    expect(body.conversationId).toMatch(/^[0-9a-f]{32}$/);

    const { env } = await import("cloudflare:test");
    const ledger = await env.DB.prepare(
      "SELECT model, plan, input_tokens, output_tokens, routed_fallback, usage_estimated, latency_ms FROM ai_usage",
    ).first<{
      model: string;
      plan: string;
      input_tokens: number;
      output_tokens: number;
      routed_fallback: number;
      usage_estimated: number;
      latency_ms: number | null;
    }>();
    expect(ledger).toMatchObject({
      model: "mock-fallback",
      plan: "guest",
      input_tokens: 21,
      output_tokens: 9,
      routed_fallback: 1,
      usage_estimated: 0,
    });
    expect(ledger?.latency_ms).not.toBeNull();

    const usage = await env.DB.prepare(
      "SELECT used FROM guest_usage WHERE feature = 'ai_tutor' LIMIT 1",
    ).first<{ used: number }>();
    expect(usage?.used).toBe(1);

    const messages = await env.DB.prepare(
      "SELECT role, content FROM messages ORDER BY created_at ASC",
    ).all<{ role: string; content: string }>();
    expect(messages.results).toHaveLength(2);
    expect(messages.results[1]?.content).toContain("Öğrenmeye başlayalım");
  });

  it("enforces the §5.1 guest limit: 3 chats allowed, 4th is 403", async () => {
    const guestCookie = await createGuest();
    for (let i = 0; i < 3; i++) {
      const res = await chat(`learwiz_guest_session=${guestCookie}`, `Soru ${i}`);
      expect(res.status).toBe(200);
    }
    const fourth = await chat(`learwiz_guest_session=${guestCookie}`, "Bir tane daha");
    expect(fourth.status).toBe(403);
    expect((await json(fourth)).error).toBe("ai_limit_reached");
  });

  it("401s anonymous chat", async () => {
    const res = await chat("", "Merhaba");
    expect(res.status).toBe(401);
  });

  it("continues a conversation when conversationId is provided", async () => {
    const guestCookie = await createGuest();
    const firstRes = await chat(`learwiz_guest_session=${guestCookie}`, "Konu: difüzörlük");
    const first = (await firstRes.json()) as ChatResponse;

    const second = await chat(`learwiz_guest_session=${guestCookie}`, "Devam et", {
      conversationId: first.conversationId,
    });
    expect(second.status).toBe(200);

    const { env } = await import("cloudflare:test");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages").first<{ n: number }>();
    // First chat: user + assistant. Second chat: same conversation, +2.
    expect(count?.n).toBe(4);
  });

  it("rejects foreign conversation ids (§40.7 ownership)", async () => {
    const a = await createGuest();
    const b = await createGuest();
    const firstRes = await chat(`learwiz_guest_session=${a}`, "benim sohbetim");
    const first = (await firstRes.json()) as ChatResponse;

    const foreign = await chat(`learwiz_guest_session=${b}`, "bulaşayım", {
      conversationId: first.conversationId,
    });
    expect(foreign.status).toBe(404);
    expect((await json(foreign)).error).toBe("conversation_not_found");
  });
});

describe("POST /api/tutor/chat (authenticated free user)", () => {
  it("records a user ledger row and enforces the 10/day free window", async () => {
    const session = await createUserSession("tutor-user@example.com");
    const cookie = `learwiz_session=${session}`;

    const first = await chat(cookie, "Kuantum dolanıklık nedir?");
    expect(first.status).toBe(200);

    const { env } = await import("cloudflare:test");
    const ledger = await env.DB.prepare(
      "SELECT user_id, plan, guest_session_id FROM ai_usage ORDER BY created_at DESC LIMIT 1",
    ).first<{ user_id: string | null; plan: string; guest_session_id: string | null }>();
    expect(ledger?.plan).toBe("free");
    expect(ledger?.user_id).not.toBeNull();
    expect(ledger?.guest_session_id).toBeNull();

    for (let i = 1; i < 10; i++) {
      const res = await chat(cookie, `Soru ${i}`);
      expect(res.status).toBe(200);
    }
    const eleventh = await chat(cookie, "Günlük hakkmı bitirdim");
    expect(eleventh.status).toBe(403);
    expect((await json(eleventh)).error).toBe("ai_limit_reached");
  });

  it("keeps conversations owner-scoped between users", async () => {
    const a = await createUserSession("owner-a@example.com");
    const firstRes = await chat(`learwiz_session=${a}`, "A'nın konusu");
    const first = (await firstRes.json()) as ChatResponse;

    const b = await createUserSession("owner-b@example.com");
    const foreign = await SELF.fetch(
      `http://local/api/tutor/conversations/${first.conversationId}`,
      {
        headers: { ...IP, cookie: `learwiz_session=${b}` },
      },
    );
    expect(foreign.status).toBe(404);

    const own = await SELF.fetch(`http://local/api/tutor/conversations/${first.conversationId}`, {
      headers: { ...IP, cookie: `learwiz_session=${a}` },
    });
    expect(own.status).toBe(200);
    const detail = (await own.json()) as ConversationDetail;
    expect(detail.messages.length).toBeGreaterThanOrEqual(2);
  });
});
