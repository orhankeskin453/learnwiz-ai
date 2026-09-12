/**
 * Auth token lifecycle (CLAUDE.md §40.9): 256-bit random tokens delivered by
 * email, stored only as SHA-256 hashes, purpose-typed, single-use, short-lived.
 * Expiry ceilings are enforced here — email_verification 24h, password_reset 1h.
 */
import { randomHex, sha256Hex } from "./sessionCrypto";

export type AuthTokenPurpose = "email_verification" | "password_reset";

const TTL_MS: Record<AuthTokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export interface CreatedToken {
  /** Raw token — returned ONCE, goes into the email link; never persisted. */
  token: string;
  expiresAt: string;
}

export async function createAuthToken(
  db: D1Database,
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<CreatedToken> {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]).toISOString();
  // Single-use discipline: a new token invalidates outstanding ones of the same
  // purpose for this user (resend-safe, prevents parallel valid tokens).
  await db
    .prepare(
      "UPDATE auth_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL",
    )
    .bind(new Date().toISOString(), userId, purpose)
    .run();
  await db
    .prepare(
      "INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      randomHex(16),
      userId,
      purpose,
      await sha256Hex(token),
      expiresAt,
      new Date().toISOString(),
    )
    .run();
  return { token, expiresAt };
}

export type ConsumedToken = { userId: string } | null;

/**
 * Validate + consume in one step. Returns the owning userId, or null when the
 * token is unknown, of the wrong purpose, expired, or already consumed.
 */
export async function consumeAuthToken(
  db: D1Database,
  token: string,
  purpose: AuthTokenPurpose,
): Promise<ConsumedToken> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      "SELECT id, user_id, expires_at, consumed_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?",
    )
    .bind(tokenHash, purpose)
    .first<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>();
  if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now()) return null;

  // Race-safe single-use: the conditional UPDATE must win exactly once — a
  // concurrent consumer's UPDATE matches 0 rows and is rejected here.
  const result = await db
    .prepare("UPDATE auth_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
    .bind(new Date().toISOString(), row.id)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return null;
  return { userId: row.user_id };
}
