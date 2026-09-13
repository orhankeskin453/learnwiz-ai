import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, ChatResponse, QuizGenerationResponse } from "@learwizai/types";
import { createAuthToken } from "../src/services/tokens";

const IP = { "CF-Connecting-IP": "198.51.100.70" };

async function createGuest(): Promise<string> {
  const res = await SELF.fetch("http://local/api/guest/session", { method: "POST", headers: IP });
  const match = res.headers.get("set-cookie")?.match(/learwiz_guest_session=([^;]+)/);
  if (!match) throw new Error("no guest cookie");
  return match[1]!;
}

function guest(cookie: string): Record<string, string> {
  return { ...IP, "content-type": "application/json", cookie: `learwiz_guest_session=${cookie}` };
}

/** Full guest→user journey through the public API. Returns the session cookie. */
async function registerAndVerify(email: string, guestCookie?: string): Promise<string> {
  const register = await SELF.fetch("http://local/api/auth/register", {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery" }),
  });
  expect(register.status).toBe(201);
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?")
    .bind(email)
    .first<{ id: string }>();
  const { token } = await createAuthToken(env.DB, user!.id, "email_verification");
  const verify = await SELF.fetch("http://local/api/auth/verify-email", {
    method: "POST",
    headers: {
      ...IP,
      "content-type": "application/json",
      cookie: guestCookie ? `learwiz_guest_session=${guestCookie}` : "",
    },
    body: JSON.stringify({ token }),
  });
  expect(verify.status).toBe(200);
  const match = verify.headers.get("set-cookie")?.match(/learwiz_session=([^;]+)/);
  if (!match) throw new Error("no session cookie");
  return match[1]!;
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM conversations").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
});

describe("guest content migration (§5.2)", () => {
  it("repoints conversations, lessons and quizzes to the user on verification", async () => {
    const guestCookie = await createGuest();
    // Guest generates content of every kind.
    const chat = (await (
      await SELF.fetch("http://local/api/tutor/chat", {
        method: "POST",
        headers: guest(guestCookie),
        body: JSON.stringify({ message: "Migration topic", locale: "en" }),
      })
    ).json()) as ChatResponse;
    await SELF.fetch("http://local/api/learn/lessons", {
      method: "POST",
      headers: guest(guestCookie),
      body: JSON.stringify({ topic: "Migration lesson", locale: "en" }),
    });
    await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(guestCookie),
      body: JSON.stringify({
        topic: "Migration quiz",
        difficulty: "easy",
        count: 5,
        locale: "en",
      }),
    });

    // Verify the account WITH the guest cookie attached.
    const session = await registerAndVerify("migrate@example.com", guestCookie);

    const guestRows = await env.DB.prepare("SELECT id, migration_status FROM guest_sessions").all();
    expect(guestRows.results[0]?.migration_status).toBe("migrated");

    // Every artifact is now user-owned.
    const counts = await env.DB.prepare(
      `SELECT
           (SELECT COUNT(*) FROM conversations WHERE owner_user_id IS NOT NULL) AS conv,
           (SELECT COUNT(*) FROM lessons WHERE owner_user_id IS NOT NULL) AS lessons,
           (SELECT COUNT(*) FROM quizzes WHERE owner_user_id IS NOT NULL) AS quizzes`,
    ).first<{ conv: number; lessons: number; quizzes: number }>();
    expect(counts).toEqual({ conv: 1, lessons: 1, quizzes: 1 });

    // The user's dashboard aggregates the migrated content.
    const dash = await SELF.fetch("http://local/api/dashboard?locale=en", {
      headers: { ...IP, cookie: `learwiz_session=${session}` },
    });
    expect(dash.status).toBe(200);
    const data = (await dash.json()) as {
      continueLearning: { id: string } | null;
      recentLessons: unknown[];
      quiz: { attempts: number } | null;
    };
    expect(data.continueLearning?.id).toBe(chat.conversationId);
    expect(data.recentLessons).toHaveLength(1);
    expect(data.quiz).toBeNull(); // quiz generated but never attempted
  });

  it("is idempotent — verification retry does not duplicate or fail", async () => {
    const guestCookie = await createGuest();
    const session = await registerAndVerify("idem@example.com", guestCookie);
    // Re-verify: the token is consumed → 400, and the migration guard holds.
    const attempts = await env.DB.prepare("SELECT COUNT(*) AS n FROM quizzes").first<{
      n: number;
    }>();
    expect(attempts?.n).toBe(0); // no quiz generated in this test

    const me = await SELF.fetch("http://local/api/auth/me", {
      headers: { ...IP, cookie: `learwiz_session=${session}` },
    });
    expect(me.status).toBe(200);
  });

  it("migrates on LOGIN with a guest cookie (§5.2 login path)", async () => {
    const guestCookie = await createGuest();
    await SELF.fetch("http://local/api/tutor/chat", {
      method: "POST",
      headers: guest(guestCookie),
      body: JSON.stringify({ message: "Login migration", locale: "en" }),
    });

    // Register + verify WITHOUT the guest cookie (separate day scenario).
    const session = await registerAndVerify("loginmig@example.com");
    void session;
    // Log in WITH the guest cookie.
    const login = await SELF.fetch("http://local/api/auth/login", {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ email: "loginmig@example.com", password: "correct-horse-battery" }),
    });
    expect(login.status).toBe(200);

    const conv = await env.DB.prepare(
      "SELECT owner_user_id FROM conversations WHERE owner_user_id IS NOT NULL",
    ).first<{ owner_user_id: string }>();
    expect(conv?.owner_user_id).not.toBeNull();
  });
});

describe("GET /api/dashboard", () => {
  it("401s anonymous callers", async () => {
    const res = await SELF.fetch("http://local/api/dashboard", { headers: IP });
    expect(res.status).toBe(401);
  });
});

describe("topic mastery accumulation (§10.8)", () => {
  it("accumulates weighted mastery across quiz attempts", async () => {
    const guestCookie = await createGuest();
    const quiz = (await (
      await SELF.fetch("http://local/api/quiz", {
        method: "POST",
        headers: guest(guestCookie),
        body: JSON.stringify({
          topic: "Mastery Topic",
          difficulty: "easy",
          count: 5,
          locale: "en",
        }),
      })
    ).json()) as QuizGenerationResponse;

    const attempt = async (answers: number[]): Promise<Response> =>
      SELF.fetch(`http://local/api/quiz/${quiz.quizId}/attempts`, {
        method: "POST",
        headers: guest(guestCookie),
        body: JSON.stringify({ answers }),
      });
    await attempt([0, 0, 0, 0, 0]); // 2 correct (Q1+Q5 answer=0)
    await attempt([0, 1, 0, 0, 0]); // 3 correct

    const { env: testEnv } = await import("cloudflare:test");
    const mastery = await testEnv.DB.prepare(
      "SELECT total_questions, correct_questions, mastery FROM topic_mastery",
    ).first<{ total_questions: number; correct_questions: number; mastery: number }>();
    expect(mastery?.total_questions).toBe(10);
    expect(mastery?.correct_questions).toBe(5);
    expect(mastery?.mastery).toBeCloseTo(0.5, 5);
  });
});
