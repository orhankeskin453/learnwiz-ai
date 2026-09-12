/**
 * Guest session persistence (CLAUDE.md §5): D1 rows are the server-authoritative
 * state; the signed cookie only carries the id. Expired or migrated sessions are
 * treated as gone — recovery is "create a new session".
 */
import type { Feature } from "@learwizai/types";

export const GUEST_COOKIE_NAME = "learwiz_guest_session";
/** §5: "reasonable expiration" — fixed 7-day window from creation (spec D3). */
export const GUEST_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface GuestSessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  migrationStatus: "pending" | "migrated" | "expired";
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function insertGuestSession(db: D1Database, id: string): Promise<GuestSessionRow> {
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_SECONDS * 1000).toISOString();
  await db
    .prepare(
      "INSERT INTO guest_sessions (id, created_at, expires_at, migration_status) VALUES (?, ?, ?, 'pending')",
    )
    .bind(id, createdAt, expiresAt)
    .run();
  return { id, createdAt, expiresAt, migrationStatus: "pending" };
}

export async function getGuestSession(db: D1Database, id: string): Promise<GuestSessionRow | null> {
  const row = await db
    .prepare("SELECT id, created_at, expires_at, migration_status FROM guest_sessions WHERE id = ?")
    .bind(id)
    .first<{
      id: string;
      created_at: string;
      expires_at: string;
      migration_status: GuestSessionRow["migrationStatus"];
    }>();
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    migrationStatus: row.migration_status,
  };
}

export function isActive(row: GuestSessionRow): boolean {
  return row.migrationStatus === "pending" && Date.parse(row.expiresAt) > Date.now();
}

/** Usage counters for one guest session — missing rows mean "never used". */
export async function getGuestUsage(
  db: D1Database,
  sessionId: string,
): Promise<Record<Feature, number>> {
  const { results } = await db
    .prepare("SELECT feature, used FROM guest_usage WHERE guest_session_id = ?")
    .bind(sessionId)
    .all<{ feature: Feature; used: number }>();
  const usage: Record<Feature, number> = { ai_tutor: 0, learn_mode: 0, practice: 0, quiz: 0 };
  for (const row of results) usage[row.feature] = row.used;
  return usage;
}

/** Increment a feature counter (idempotent-safe upsert; feature routes call AFTER the handler ran). */
export async function recordGuestUsage(
  db: D1Database,
  sessionId: string,
  feature: Feature,
  amount = 1,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO guest_usage (guest_session_id, feature, used, last_used_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (guest_session_id, feature) DO UPDATE SET used = used + excluded.used, last_used_at = excluded.last_used_at`,
    )
    .bind(sessionId, feature, amount, nowIso())
    .run();
}

/** Record where a guest session ended up, for abuse checks and migration bookkeeping (§5.2). */
export async function setMigrationStatus(
  db: D1Database,
  id: string,
  status: GuestSessionRow["migrationStatus"],
): Promise<void> {
  await db
    .prepare("UPDATE guest_sessions SET migration_status = ? WHERE id = ?")
    .bind(status, id)
    .run();
}
