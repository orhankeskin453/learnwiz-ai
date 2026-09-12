/**
 * Conversation persistence (CLAUDE.md §16) with strict single-owner isolation
 * (§40.7): every query is scoped to the resolved identity's owner key.
 */
import { randomHex } from "../sessionCrypto";
import type { Locale, TutorAction, TutorMessage } from "@learwizai/types";

export interface ConversationOwner {
  userId: string | null;
  guestSessionId: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createConversation(
  db: D1Database,
  owner: ConversationOwner,
  locale: Locale,
  title: string,
): Promise<string> {
  const id = randomHex(16);
  const at = nowIso();
  await db
    .prepare(
      "INSERT INTO conversations (id, owner_user_id, owner_guest_session_id, title, locale, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, owner.userId, owner.guestSessionId, title, locale, at, at)
    .run();
  return id;
}

/** Ownership-checked load — returns null when missing OR owned by someone else. */
export async function getOwnedConversation(
  db: D1Database,
  id: string,
  owner: ConversationOwner,
): Promise<{ id: string; title: string; locale: Locale; updatedAt: string } | null> {
  const row = await db
    .prepare(
      "SELECT id, title, locale, updated_at, owner_user_id, owner_guest_session_id FROM conversations WHERE id = ?",
    )
    .bind(id)
    .first<{
      id: string;
      title: string;
      locale: Locale;
      updated_at: string;
      owner_user_id: string | null;
      owner_guest_session_id: string | null;
    }>();
  if (!row) return null;
  if (row.owner_user_id !== owner.userId || row.owner_guest_session_id !== owner.guestSessionId) {
    return null;
  }
  return { id: row.id, title: row.title, locale: row.locale, updatedAt: row.updated_at };
}

export async function listConversations(
  db: D1Database,
  owner: ConversationOwner,
): Promise<Array<{ id: string; title: string; locale: Locale; updatedAt: string }>> {
  const { results } = await db
    .prepare(
      "SELECT id, title, locale, updated_at FROM conversations WHERE owner_user_id IS ? AND owner_guest_session_id IS ? ORDER BY updated_at DESC LIMIT 50",
    )
    .bind(owner.userId, owner.guestSessionId)
    .all<{ id: string; title: string; locale: Locale; updated_at: string }>();
  return results.map((r) => ({
    id: r.id,
    title: r.title,
    locale: r.locale,
    updatedAt: r.updated_at,
  }));
}

export async function addMessage(
  db: D1Database,
  conversationId: string,
  role: "user" | "assistant",
  action: TutorAction | null,
  content: string,
): Promise<string> {
  const id = randomHex(16);
  await db
    .prepare(
      "INSERT INTO messages (id, conversation_id, role, action, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, conversationId, role, action, content, nowIso())
    .run();
  await db
    .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
    .bind(nowIso(), conversationId)
    .run();
  return id;
}

/** Context window for the AI — the most recent `limit` messages in order. */
export async function getRecentMessages(
  db: D1Database,
  conversationId: string,
  limit = 10,
): Promise<TutorMessage[]> {
  const { results } = await db
    .prepare(
      "SELECT id, role, action, content, created_at FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at ASC",
    )
    .bind(conversationId, limit)
    .all<{
      id: string;
      role: "user" | "assistant";
      action: TutorAction | null;
      content: string;
      created_at: string;
    }>();
  return results.map((r) => ({
    id: r.id,
    role: r.role,
    action: r.action,
    content: r.content,
    createdAt: r.created_at,
  }));
}
