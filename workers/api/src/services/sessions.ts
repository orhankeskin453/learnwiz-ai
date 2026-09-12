/**
 * Server-authoritative sessions (CLAUDE.md §40.4/§47.9): the cookie carries a
 * 256-bit random token; D1 stores only its SHA-256 hash. Fixed 30-day expiry;
 * revocation (single + all) supported for logout and password resets.
 */
import { randomHex, sha256Hex } from "./sessionCrypto";

export const SESSION_COOKIE_NAME = "learwiz_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface ResolvedSession {
  sessionId: string;
  userId: string;
}

export async function createSession(db: D1Database, userId: string): Promise<{ token: string }> {
  const token = randomHex(32);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(randomHex(16), userId, await sha256Hex(token), now, now, expiresAt)
    .run();
  return { token };
}

/**
 * Resolve a session token against D1. Returns null for unknown, expired, or
 * revoked tokens. Account status (suspended etc.) is checked by the caller
 * together with the user row.
 */
export async function resolveSession(
  db: D1Database,
  token: string,
): Promise<ResolvedSession | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at
       FROM sessions s WHERE s.token_hash = ?`,
    )
    .bind(await sha256Hex(token))
    .first<{
      session_id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>();
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) return null;
  return { sessionId: row.session_id, userId: row.user_id };
}

export async function revokeSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), sessionId)
    .run();
}

/** §40.4: revoke all sessions after security-sensitive events (password reset). */
export async function revokeAllSessions(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), userId)
    .run();
}
