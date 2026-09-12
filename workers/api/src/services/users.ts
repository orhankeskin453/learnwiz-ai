/**
 * User persistence for the auth surface (CLAUDE.md §40.1/§40.3). Emails are
 * normalized (trimmed + lowercased) at the validation layer and stored in
 * email_normalized — the lookup key for login/anti-enumeration checks.
 */
import { randomHex } from "./sessionCrypto";

export interface UserRow {
  id: string;
  email: string;
  locale: "en" | "tr";
  status: "pending" | "active" | "suspended" | "deleted";
  emailVerifiedAt: string | null;
  createdAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function findUserByEmail(
  db: D1Database,
  emailNormalized: string,
): Promise<UserRow | null> {
  const row = await db
    .prepare(
      "SELECT id, email, locale, status, email_verified_at, created_at FROM users WHERE email_normalized = ?",
    )
    .bind(emailNormalized)
    .first<{
      id: string;
      email: string;
      locale: UserRow["locale"];
      status: UserRow["status"];
      email_verified_at: string | null;
      created_at: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    locale: row.locale,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
  };
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await db
    .prepare(
      "SELECT id, email, locale, status, email_verified_at, created_at FROM users WHERE id = ?",
    )
    .bind(id)
    .first<{
      id: string;
      email: string;
      locale: UserRow["locale"];
      status: UserRow["status"];
      email_verified_at: string | null;
      created_at: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    locale: row.locale,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
  };
}

export async function createUser(
  db: D1Database,
  input: { email: string; emailNormalized: string; passwordHash: string },
): Promise<UserRow> {
  const id = randomHex(16);
  const createdAt = nowIso();
  await db
    .prepare(
      "INSERT INTO users (id, email, email_normalized, password_hash, status, locale, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 'en', ?, ?)",
    )
    .bind(id, input.email, input.emailNormalized, input.passwordHash, createdAt, createdAt)
    .run();
  return {
    id,
    email: input.email,
    locale: "en",
    status: "pending",
    emailVerifiedAt: null,
    createdAt,
  };
}

/** Verification = account activation (§40.3). */
export async function markEmailVerified(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE users SET email_verified_at = ?, status = 'active', updated_at = ? WHERE id = ?",
    )
    .bind(nowIso(), nowIso(), id)
    .run();
}

export async function updatePasswordHash(
  db: D1Database,
  id: string,
  passwordHash: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .bind(passwordHash, nowIso(), id)
    .run();
}

/** Password hash for login verification — never leaves the worker process. */
export async function getPasswordHashById(db: D1Database, id: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(id)
    .first<{ password_hash: string | null }>();
  return row?.password_hash ?? null;
}
