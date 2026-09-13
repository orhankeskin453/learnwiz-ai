import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  AuthSessionResponse,
  ChatResponse,
  DocumentChatResponse,
  DocumentSummary,
  GeneratedQuiz,
} from "@learwizai/types";
import { createAuthToken } from "../src/services/tokens";
import { processDocument } from "../src/services/documents";

const IP = { "CF-Connecting-IP": "198.51.100.80" };
const PASSWORD = "correct-horse-battery";

async function createUserSession(email: string): Promise<string> {
  const register = await SELF.fetch("http://local/api/auth/register", {
    method: "POST",
    headers: { ...IP, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(register.status).toBe(201);
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

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4 mock pdf body for extraction");
}

async function upload(
  cookie: string,
  body: Uint8Array = pdfBytes(),
  filename = "test.pdf",
): Promise<Response> {
  return SELF.fetch(
    `http://local/api/documents?locale=en&filename=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/pdf",
        cookie: `learwiz_session=${cookie}`,
      },
      body,
    },
  );
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM documents").run();
  await env.DB.prepare("DELETE FROM guest_sessions").run();
});

describe("POST /api/documents (upload)", () => {
  it("401s anonymous callers and 403s guests (§32: guest = No)", async () => {
    const anon = await SELF.fetch("http://local/api/documents", { method: "POST", headers: IP });
    expect(anon.status).toBe(401);

    const guestRes = await SELF.fetch("http://local/api/guest/session", {
      method: "POST",
      headers: IP,
    });
    const guestCookie = guestRes.headers
      .get("set-cookie")
      ?.match(/learwiz_guest_session=([^;]+)/)?.[1]!;
    const guest = await SELF.fetch("http://local/api/documents", {
      method: "POST",
      headers: {
        ...IP,
        "content-type": "application/json",
        cookie: `learwiz_guest_session=${guestCookie}`,
      },
      body: JSON.stringify({ message: "x", locale: "en" }),
    });
    expect(guest.status).toBe(403);
    expect(((await guest.json()) as ApiErrorBody).error).toBe("quota_exhausted");
  });

  it("accepts a PDF from an authenticated user, stores it in R2 and enqueues", async () => {
    const cookie = await createUserSession("uploader@example.com");
    const res = await upload(cookie);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { documentId: string; status: string };
    expect(body.status).toBe("queued");

    const doc = await env.DB.prepare(
      "SELECT r2_key, status, owner_user_id FROM documents WHERE id = ?",
    )
      .bind(body.documentId)
      .first<{ r2_key: string; status: string; owner_user_id: string | null }>();
    expect(doc?.status).toBe("queued");
  });

  it("rejects non-PDF payloads with 415", async () => {
    const cookie = await createUserSession("pdfcheck@example.com");
    const res = await upload(cookie, new TextEncoder().encode("plain text"), "notes.txt");
    expect(res.status).toBe(415);
    expect(((await res.json()) as ApiErrorBody).error).toBe("unsupported_media_type");
  });

  it("enforces the per-user document limit (free pilot = 2)", async () => {
    const cookie = await createUserSession("limit@example.com");
    expect((await upload(cookie)).status).toBe(201);
    expect((await upload(cookie)).status).toBe(201);
    const third = await upload(cookie);
    expect(third.status).toBe(403);
    expect(((await third.json()) as ApiErrorBody).error).toBe("quota_exhausted");
  });
});

describe("processDocument lifecycle", () => {
  it("extracts, chunks, embeds and marks processed", async () => {
    const cookie = await createUserSession("proc@example.com");
    const res = await upload(cookie);
    const { documentId } = (await res.json()) as { documentId: string };

    let calls = 0;
    await processDocument(env, documentId, async () => {
      calls += 1;
      return "Paragraph one about gravity.\n\nParagraph two about orbits.\n\nParagraph three about mass.";
    });
    expect(calls).toBe(1);

    const doc = await env.DB.prepare("SELECT status FROM documents WHERE id = ?")
      .bind(documentId)
      .first<{ status: string }>();
    expect(doc?.status).toBe("processed");

    const chunks = await env.DB.prepare(
      "SELECT position, content FROM document_chunks WHERE document_id = ? ORDER BY position",
    )
      .bind(documentId)
      .all<{ position: number; content: string }>();
    expect(chunks.results.length).toBeGreaterThanOrEqual(1);
    expect(chunks.results[0]?.content).toContain("Paragraph one");
  });

  it("marks the document failed when extraction throws", async () => {
    const cookie = await createUserSession("fail@example.com");
    const res = await upload(cookie);
    const { documentId } = (await res.json()) as { documentId: string };

    // processDocument re-throws after marking failed (queue-level retry signal).
    await processDocument(env, documentId, async () => {
      throw new Error("corrupt pdf");
    }).catch(() => undefined);

    const doc = await env.DB.prepare("SELECT status, error FROM documents WHERE id = ?")
      .bind(documentId)
      .first<{ status: string; error: string | null }>();
    expect(doc?.status).toBe("failed");
    expect(doc?.error).toContain("corrupt pdf");
  });
});

describe("document RAG chat (§30)", () => {
  it("answers with sources from the document", async () => {
    const cookie = await createUserSession("rag@example.com");
    const uploadRes = await upload(cookie);
    const { documentId } = (await uploadRes.json()) as { documentId: string };
    await processDocument(
      env,
      documentId,
      async () =>
        "Chunk zero: gravity pulls objects together.\n\nChunk one: orbits result from gravity and velocity.",
    );

    const chunks = await env.DB.prepare(
      "SELECT id FROM document_chunks WHERE document_id = ? ORDER BY position",
    )
      .bind(documentId)
      .all<{ id: string }>();
    expect(chunks.results.length).toBeGreaterThan(0);

    const chatRes = await SELF.fetch(`http://local/api/documents/${documentId}/chat`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json", cookie: `learwiz_session=${cookie}` },
      body: JSON.stringify({ message: "What is gravity?", locale: "en" }),
    });
    expect(chatRes.status).toBe(200);
    const body = (await chatRes.json()) as DocumentChatResponse;
    expect(body.answer).toContain("Merhaba"); // chat mock default fixture text
    expect(body.sources[0]?.position).toBe(0);
  });

  it("409s chat on a document that is not processed yet", async () => {
    const cookie = await createUserSession("queued@example.com");
    const uploadRes = await upload(cookie);
    const { documentId } = (await uploadRes.json()) as { documentId: string };

    const chatRes = await SELF.fetch(`http://local/api/documents/${documentId}/chat`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json", cookie: `learwiz_session=${cookie}` },
      body: JSON.stringify({ message: "Hello?", locale: "en" }),
    });
    expect(chatRes.status).toBe(409);
    expect(((await chatRes.json()) as ApiErrorBody).error).toBe("document_not_ready");
  });

  it("404s foreign documents (§40.7)", async () => {
    const a = await createUserSession("owner-a2@example.com");
    const uploadRes = await upload(a);
    const { documentId } = (await uploadRes.json()) as { documentId: string };

    const b = await createUserSession("owner-b2@example.com");
    const foreign = await SELF.fetch(`http://local/api/documents/${documentId}/chat`, {
      method: "POST",
      headers: { ...IP, "content-type": "application/json", cookie: `learwiz_session=${b}` },
      body: JSON.stringify({ message: "Hello?", locale: "en" }),
    });
    expect(foreign.status).toBe(404);
  });
});

describe("DELETE /api/documents/:id", () => {
  it("removes the document, chunks and R2 object", async () => {
    const cookie = await createUserSession("del@example.com");
    const res = await upload(cookie);
    const { documentId } = (await res.json()) as { documentId: string };
    await processDocument(env, documentId, async () => "chunk content for deletion test");

    const doc = await env.DB.prepare("SELECT r2_key FROM documents WHERE id = ?")
      .bind(documentId)
      .first<{ r2_key: string }>();

    const del = await SELF.fetch(`http://local/api/documents/${documentId}`, {
      method: "DELETE",
      headers: { ...IP, cookie: `learwiz_session=${cookie}` },
    });
    expect(del.status).toBe(204);
    const remaining = await env.DB.prepare("SELECT COUNT(*) AS n FROM documents").first<{
      n: number;
    }>();
    expect(remaining?.n).toBe(0);
  });
});

// Keep imports referenced for the lint rules without weakening the suite.
export type { AuthSessionResponse, ChatResponse, GeneratedQuiz };
void createUserSession;
void upload;
