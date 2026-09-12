import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, ChatResponse, Lesson } from "@learwizai/types";
import type { LessonContent } from "@learwizai/validation";

const IP = { "CF-Connecting-IP": "198.51.100.40" };

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
  await env.DB.prepare("DELETE FROM conversations").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
});

describe("POST /api/learn/lessons (guest)", () => {
  it("generates a validated six-block lesson and burns the guest topic", async () => {
    const cookie = await createGuest();
    const res = await SELF.fetch("http://local/api/learn/lessons", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Photosynthesis", locale: "en" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lessonId: string; lesson: Lesson };
    expect(body.lesson.title).toBe("Photosynthesis");
    expect(body.lesson.blocks.map((b) => b.kind)).toEqual([
      "concept",
      "intuition",
      "example",
      "common_mistakes",
      "mini_exercise",
      "check_understanding",
    ]);
    expect(body.lesson.blocks[5]?.question).toContain("gas");

    const { env } = await import("cloudflare:test");
    const usage = await env.DB.prepare(
      "SELECT used FROM guest_usage WHERE feature = 'learn_mode'",
    ).first<{ used: number }>();
    expect(usage?.used).toBe(1);
    const ledger = await env.DB.prepare("SELECT task_type FROM ai_usage").first<{
      task_type: string;
    }>();
    expect(ledger?.task_type).toBe("learn");
  });

  it("enforces the §5.1 guest limit: 1 lesson, then 403", async () => {
    const cookie = await createGuest();
    const first = await SELF.fetch("http://local/api/learn/lessons", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Gravity", locale: "en" }),
    });
    expect(first.status).toBe(200);
    const lesson = (await first.json()) as { lessonId: string; lesson: Lesson };

    const second = await SELF.fetch("http://local/api/learn/lessons", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ topic: "Another topic", locale: "en" }),
    });
    expect(second.status).toBe(403);
    expect(((await second.json()) as ApiErrorBody).error).toBe("quota_exhausted");

    // The owner can still re-read the generated lesson.
    const detail = await SELF.fetch(`http://local/api/learn/lessons/${lesson.lessonId}`, {
      headers: guest(cookie),
    });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { content: LessonContent };
    expect(detailBody.content.blocks).toHaveLength(6);
  });

  it("keeps lessons owner-scoped (§40.7)", async () => {
    const a = await createGuest();
    const created = await SELF.fetch("http://local/api/learn/lessons", {
      method: "POST",
      headers: guest(a),
      body: JSON.stringify({ topic: "Private topic", locale: "en" }),
    });
    const { lessonId } = (await created.json()) as { lessonId: string };

    const b = await createGuest();
    const foreign = await SELF.fetch(`http://local/api/learn/lessons/${lessonId}`, {
      headers: guest(b),
    });
    expect(foreign.status).toBe(404);
  });
});

describe("tutor regression guard (shared mock)", () => {
  it("still answers chat with the default fixture text", async () => {
    const cookie = await createGuest();
    const res = await SELF.fetch("http://local/api/tutor/chat", {
      method: "POST",
      headers: guest(cookie),
      body: JSON.stringify({ message: "Hi", locale: "en" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ChatResponse;
    expect(body.assistantMessage).toContain("Merhaba! Öğrenmeye başlayalım.");
  });
});
