import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { AiUnavailableError, extractJson, generateStructured } from "../src/services/ai/generate";
import {
  recordAiUsage,
  countUserAiUsageToday,
  countUserQuizUsageThisMonth,
} from "../src/services/ai/usage";

const schema = { parse: (value: unknown) => value as { answer: number } };

const base = {
  messages: [
    { role: "system" as const, content: "lesson architect fixture" },
    { role: "user" as const, content: "topic" },
  ],
  schema,
};

/** Override the mock fixture per test (env is a plain object binding). */
function withMock(spec: unknown): typeof env {
  return {
    ...env,
    AI_MOCK_RESPONSES: JSON.stringify(spec),
    // Spread may not carry string bindings reliably — pin the mock models.
    AI_PRIMARY_MODEL: "mock-primary",
    AI_FALLBACK_MODEL: "mock-fallback",
  };
}

const VALID = JSON.stringify({ answer: 42 });

describe("extractJson (§10.6)", () => {
  it("parses fenced and prose-wrapped JSON", () => {
    expect(extractJson('```json\n{"answer": 1}\n```')).toEqual({ answer: 1 });
    expect(extractJson('Here you go: {"answer": 2} — hope it helps!')).toEqual({ answer: 2 });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("generateStructured (§10.6/§18)", () => {
  it("returns validated data from the primary model", async () => {
    const result = await generateStructured(
      withMock({
        "mock-primary": {
          behavior: "stream",
          text: VALID,
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        },
      }),
      base,
    );
    expect(result.data).toEqual({ answer: 42 });
    expect(result.fallback).toBe(false);
  });

  it("falls back once when the primary emits malformed JSON, then 503s if both fail", async () => {
    const malformed = {
      behavior: "stream",
      text: "sorry, I cannot do that",
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    };
    // Primary malformed → fallback valid → succeeds (single §18 fallback).
    const recovered = await generateStructured(
      withMock({
        "mock-primary": malformed,
        "mock-fallback": {
          behavior: "stream",
          text: VALID,
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        },
      }),
      base,
    );
    expect(recovered.fallback).toBe(true);

    // Both malformed → AiUnavailableError (route maps to 503).
    await expect(
      generateStructured(withMock({ "mock-primary": malformed, "mock-fallback": malformed }), base),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe("Free-pool accounting (§10.10 shared pool + §32 monthly quiz)", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM ai_usage").run();
    // ai_usage.user_id references users — create a real row for FK integrity.
    await env.DB.prepare(
      "INSERT INTO users (id, email, email_normalized, status, locale, created_at, updated_at) VALUES (?, ?, ?, 'active', 'en', ?, ?)",
    )
      .bind(
        "u1",
        "pool@example.com",
        "pool@example.com",
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
  });

  it("counts every AI task type toward the shared daily pool", async () => {
    const entry = {
      userId: "u1",
      guestSessionId: null,
      model: "m",
      taskType: "tutor",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: null,
      neurons: null,
      plan: "free" as const,
      locale: "en" as const,
      routedFallback: false,
      usageEstimated: false,
    };
    await recordAiUsage(env.DB, { ...entry, taskType: "tutor" });
    await recordAiUsage(env.DB, { ...entry, taskType: "learn" });
    await recordAiUsage(env.DB, { ...entry, taskType: "quiz" });
    expect(await countUserAiUsageToday(env.DB, "u1")).toBe(3);
  });

  it("counts monthly quiz usage separately", async () => {
    const entry = {
      userId: "u1",
      guestSessionId: null,
      model: "m",
      taskType: "quiz",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: null,
      neurons: null,
      plan: "free" as const,
      locale: "en" as const,
      routedFallback: false,
      usageEstimated: false,
    };
    await recordAiUsage(env.DB, entry);
    await recordAiUsage(env.DB, entry);
    expect(await countUserQuizUsageThisMonth(env.DB, "u1")).toBe(2);
    expect(await countUserAiUsageToday(env.DB, "u1")).toBe(2);
  });
});
