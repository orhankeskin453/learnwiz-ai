import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { QuizGenerationResponse } from "@learwizai/types";
import { CHUNK_SIZE, splitCount } from "../src/services/ai/questionSets";
import { createAuthToken } from "../src/services/tokens";

const IP = { "CF-Connecting-IP": "198.51.100.95" };

describe("splitCount (parallel chunking)", () => {
  it("keeps small sets as a single call", () => {
    expect(splitCount(3)).toEqual([3]);
    expect(splitCount(CHUNK_SIZE)).toEqual([CHUNK_SIZE]);
  });

  it("splits larger sets into parallel chunks of at most CHUNK_SIZE", () => {
    expect(splitCount(7)).toEqual([5, 2]);
    expect(splitCount(10)).toEqual([5, 5]);
    for (const size of splitCount(10)) expect(size).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(splitCount(10).reduce((a, b) => a + b, 0)).toBe(10);
  });
});

async function createGuest(): Promise<string> {
  const res = await SELF.fetch("http://local/api/guest/session", { method: "POST", headers: IP });
  const match = res.headers.get("set-cookie")?.match(/learwiz_guest_session=([^;]+)/);
  if (!match) throw new Error("no guest cookie");
  return match[1]!;
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
  await env.DB.prepare("DELETE FROM ai_usage").run();
});

describe("parallel chunk generation", () => {
  it("a 10-question quiz runs two model calls and records ONE summed ledger row", async () => {
    const guestCookie = await createGuest();
    const res = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ topic: "Paralel test", difficulty: "easy", count: 10, locale: "tr" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as QuizGenerationResponse;
    // The mock fixture returns the same 5 questions per call, so the duplicate
    // guard collapses them — the point of this test is the call count below.
    expect(body.questions.length).toBeGreaterThanOrEqual(1);

    // Exactly one ledger row (one user-facing generation = one message)…
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_usage").first<{ n: number }>();
    expect(rows?.n).toBe(1);

    // …but with the tokens of BOTH parallel calls summed (fixture: 21/9 each).
    const ledger = await env.DB.prepare(
      "SELECT task_type, input_tokens, output_tokens, latency_ms FROM ai_usage",
    ).first<{
      task_type: string;
      input_tokens: number;
      output_tokens: number;
      latency_ms: number | null;
    }>();
    expect(ledger?.task_type).toBe("quiz");
    expect(ledger?.input_tokens).toBe(42);
    expect(ledger?.output_tokens).toBe(18);
    expect(ledger?.latency_ms).not.toBeNull(); // generation latency is now recorded
  });

  it("a 5-question quiz stays a single call", async () => {
    const guestCookie = await createGuest();
    const res = await SELF.fetch("http://local/api/quiz", {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ topic: "Tek parça", difficulty: "easy", count: 5, locale: "tr" }),
    });
    expect(res.status).toBe(200);
    const ledger = await env.DB.prepare("SELECT input_tokens, output_tokens FROM ai_usage").first<{
      input_tokens: number;
      output_tokens: number;
    }>();
    expect(ledger?.input_tokens).toBe(21);
    expect(ledger?.output_tokens).toBe(9);
  });
});

// createAuthToken is used by other suites in this folder; keep the import honest.
void createAuthToken;
