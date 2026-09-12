import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, GeneratedQuiz, QuizGenerationResponse } from "@learwizai/types";

const IP = { "CF-Connecting-IP": "198.51.100.50" };

async function createGuest(): Promise<string> {
  const res = await SELF.fetch("http://local/api/guest/session", { method: "POST", headers: IP });
  const match = res.headers.get("set-cookie")?.match(/learwiz_guest_session=([^;]+)/);
  if (!match) throw new Error("no guest cookie");
  return match[1]!;
}

function guest(cookie: string): Record<string, string> {
  return { ...IP, "content-type": "application/json", cookie: `learwiz_guest_session=${cookie}` };
}

beforeEach(async () => {
  const { env } = await import("cloudflare:test");
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
});

describe("POST /api/practice (guest)", () => {
  it("generates a 3-question validated set and burns 3 guest question units", async () => {
    const cookie = await createGuest();
    const res = await SELF.fetch("http://local/api/practice", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Photosynthesis", count: 3, locale: "en" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GeneratedQuiz;
    expect(body.questions).toHaveLength(3);
    for (const q of body.questions) {
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(3);
    }

    const { env } = await import("cloudflare:test");
    const usage = await env.DB.prepare(
      "SELECT used FROM guest_usage WHERE feature = 'practice'",
    ).first<{ used: number }>();
    expect(usage?.used).toBe(3); // §5.1: 3 QUESTIONS per guest session
  });

  it("enforces the §5.1 limit: a second session is 403", async () => {
    const cookie = await createGuest();
    const first = await SELF.fetch("http://local/api/practice", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", locale: "en" }),
    });
    expect(first.status).toBe(200);

    const second = await SELF.fetch("http://local/api/practice", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", locale: "en" }),
    });
    expect(second.status).toBe(403);
    expect(((await second.json()) as ApiErrorBody).error).toBe("quota_exhausted");
  });
});

describe("POST /api/quiz + attempts (guest)", () => {
  it("generates a 5-question quiz and scores attempts server-side", async () => {
    const cookie = await createGuest();
    const res = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", difficulty: "easy", count: 5, locale: "en" }),
    });
    expect(res.status).toBe(200);
    const quiz = (await res.json()) as QuizGenerationResponse;
    expect(quiz.questions).toHaveLength(5);

    // Fixture answers: 0,1,2,3,0 — answer all but Q2 and Q5 correctly.
    const answers = [0, 1, 0, 3, 1];
    const attempt = await SELF.fetch(`http://local/api/quiz/${quiz.quizId}/attempts`, {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ answers }),
    });
    expect(attempt.status).toBe(200);
    const result = (await attempt.json()) as { score: number; total: number };
    expect(result).toEqual({ score: 3, total: 5 });

    const second = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", difficulty: "easy", count: 5, locale: "en" }),
    });
    expect(second.status).toBe(403); // §5.1: 1 quiz per guest session
  });

  it("rejects attempts against foreign quizzes (§40.7)", async () => {
    const a = await createGuest();
    const created = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(a),
      body: JSON.stringify({ topic: "Gravity", difficulty: "easy", count: 5, locale: "en" }),
    });
    const quiz = (await created.json()) as QuizGenerationResponse;

    const b = await createGuest();
    const foreign = await SELF.fetch(`http://local/api/quiz/${quiz.quizId}/attempts`, {
      method: "POST",
      headers: guest(b),
      body: JSON.stringify({ answers: [0, 0, 0, 0, 0] }),
    });
    expect(foreign.status).toBe(404);
  });

  it("rejects invalid counts and unknown difficulty", async () => {
    const cookie = await createGuest();
    const badCount = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", difficulty: "easy", count: 4, locale: "en" }),
    });
    expect(badCount.status).toBe(400);

    const badDifficulty = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", difficulty: "impossible", count: 5, locale: "en" }),
    });
    expect(badDifficulty.status).toBe(400);
  });
});
