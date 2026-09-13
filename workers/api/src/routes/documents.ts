import { Hono, type Context } from "hono";
import { documentChatSchema } from "@learwizai/validation";
import type { DocumentChatResponse, DocumentSummary } from "@learwizai/types";
import type { AppEnv } from "../context";
import { clientIp } from "../middleware/identity";
import { enforceWindow } from "../services/rateLimit";
import { DOCUMENTS_LIMITS } from "../services/entitlements";
import {
  countOwnedDocuments,
  deleteDocument,
  getOwnedDocument,
  insertDocument,
  listOwnedDocuments,
  answerDocumentQuestion,
  r2Key,
  MAX_DOCUMENT_BYTES,
  type Owner,
} from "../services/documents";
import { AiUnavailableError } from "../services/ai/generate";

/** Documents (CLAUDE.md §10.1, §12.1, §15) — upload/list/detail/delete/RAG chat. */
export const documentsRoute = new Hono<AppEnv>();

export function docOwnerOf(c: Context<AppEnv>): Owner {
  const identity = c.get("identity");
  return identity.kind === "user"
    ? { userId: identity.userId, guestSessionId: null }
    : { userId: null, guestSessionId: identity.kind === "guest" ? identity.sessionId : null };
}

documentsRoute.post("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const plan = identity.kind === "guest" ? "guest" : "free";
  const limit = DOCUMENTS_LIMITS[plan];
  if (limit === 0) {
    return c.json(
      { error: "quota_exhausted", message: "document upload requires an upgrade" } satisfies {
        error: "quota_exhausted";
        message?: string;
      },
      403,
    );
  }

  const throttle = await enforceWindow(
    c.env.CACHE,
    { bucket: "doc-upload", key: clientIp(c), max: 10, windowSeconds: 3600 },
    c.env.GUEST_SESSION_SECRET ?? "tutor-throttle-pepper",
  );
  if (!throttle) {
    return c.json({ error: "rate_limited" } satisfies { error: "rate_limited" }, 429);
  }

  const filename = c.req.query("filename") ?? "document.pdf";
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/pdf") || !filename.toLowerCase().endsWith(".pdf")) {
    return c.json(
      { error: "unsupported_media_type" } satisfies { error: "unsupported_media_type" },
      415,
    );
  }
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf || bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return c.json(
      {
        error:
          bytes.byteLength > MAX_DOCUMENT_BYTES ? "payload_too_large" : "unsupported_media_type",
      } satisfies {
        error: "payload_too_large" | "unsupported_media_type";
      },
      bytes.byteLength > MAX_DOCUMENT_BYTES ? 413 : 415,
    );
  }

  const owned = await countOwnedDocuments(c.env.DB, docOwnerOf(c));
  if (owned >= limit) {
    return c.json(
      { error: "quota_exhausted", message: "document limit reached" } satisfies {
        error: "quota_exhausted";
        message?: string;
      },
      403,
    );
  }

  const owner = docOwnerOf(c);
  const title = filename.replace(/\.pdf$/i, "").slice(0, 120) || "Document";
  const locale = c.req.query("locale") === "tr" ? "tr" : "en";
  const documentId = await insertDocument(c.env.DB, owner, {
    title,
    filename,
    r2Key: r2Key(owner, "pending"),
    sizeBytes: bytes.byteLength,
    locale,
  });
  const key = r2Key(owner, documentId);
  await c.env.DOCS.put(key, bytes);
  await c.env.DB.prepare("UPDATE documents SET r2_key = ? WHERE id = ?")
    .bind(key, documentId)
    .run();
  // Test seam: AI_MOCK_RESPONSES is test-only — skip the real queue in CI.
  if (!c.env.AI_MOCK_RESPONSES) {
    await c.env.DOCS_QUEUE.send({ documentId });
  }
  return c.json(
    { documentId, status: "queued" } satisfies { documentId: string; status: string },
    201,
  );
});

documentsRoute.get("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const rows = await listOwnedDocuments(c.env.DB, docOwnerOf(c));
  const body: DocumentSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
  }));
  return c.json(body);
});

documentsRoute.get("/:id", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const doc = await getOwnedDocument(c.env.DB, c.req.param("id"), docOwnerOf(c));
  if (!doc) {
    return c.json({ error: "document_not_found" } satisfies { error: "document_not_found" }, 404);
  }
  return c.json(doc);
});

documentsRoute.delete("/:id", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const owner = docOwnerOf(c);
  const doc = await getOwnedDocument(c.env.DB, c.req.param("id"), owner);
  if (!doc) {
    return c.json({ error: "document_not_found" } satisfies { error: "document_not_found" }, 404);
  }
  await deleteDocument(c.env, doc.id, r2Key(owner, doc.id));
  return c.body(null, 204);
});

documentsRoute.post("/:id/chat", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const parsed = documentChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const owner = docOwnerOf(c);
  const doc = await getOwnedDocument(c.env.DB, c.req.param("id"), owner);
  if (!doc) {
    return c.json({ error: "document_not_found" } satisfies { error: "document_not_found" }, 404);
  }
  if (doc.status !== "processed") {
    return c.json({ error: "document_not_ready" } satisfies { error: "document_not_ready" }, 409);
  }
  try {
    const body: DocumentChatResponse = await answerDocumentQuestion(
      c.env.DB,
      c.env,
      doc.id,
      parsed.data.message,
      parsed.data.locale,
    );
    return c.json(body);
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return c.json({ error: "ai_unavailable" } satisfies { error: "ai_unavailable" }, 503);
    }
    throw error;
  }
});
