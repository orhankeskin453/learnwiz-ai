/**
 * Guest → user migration (CLAUDE.md §5.2): one atomic D1 batch repoints every
 * owned artifact to the user and marks the guest session migrated. Idempotent —
 * the guard read plus idempotent UPDATEs make raced signups harmless.
 * Guest usage counters do NOT transfer (guest entitlement state, §5.2).
 */
import type { ConversationOwner as Owner } from "./ai/conversations";

export async function migrateGuestContent(
  db: D1Database,
  guestSessionId: string,
  userId: string,
): Promise<boolean> {
  const session = await db
    .prepare("SELECT migration_status FROM guest_sessions WHERE id = ?")
    .bind(guestSessionId)
    .first<{ migration_status: string }>();
  if (!session || session.migration_status !== "pending") return false;

  await db.batch([
    db
      .prepare(
        "UPDATE conversations SET owner_user_id = ?, owner_guest_session_id = NULL WHERE owner_guest_session_id = ?",
      )
      .bind(userId, guestSessionId),
    db
      .prepare(
        "UPDATE lessons SET owner_user_id = ?, owner_guest_session_id = NULL WHERE owner_guest_session_id = ?",
      )
      .bind(userId, guestSessionId),
    db
      .prepare(
        "UPDATE quizzes SET owner_user_id = ?, owner_guest_session_id = NULL WHERE owner_guest_session_id = ?",
      )
      .bind(userId, guestSessionId),
    db
      .prepare(
        "UPDATE topic_mastery SET owner_user_id = ?, owner_guest_session_id = NULL WHERE owner_guest_session_id = ?",
      )
      .bind(userId, guestSessionId),
    db
      .prepare(
        "UPDATE guest_sessions SET migration_status = 'migrated' WHERE id = ? AND migration_status = 'pending'",
      )
      .bind(guestSessionId),
  ]);
  return true;
}

/** Runs the migration when the request carries a live guest session (§5.2 login path). */
export async function migrateIfGuest(db: D1Database, owner: Owner, userId: string): Promise<void> {
  if (owner.guestSessionId) {
    await migrateGuestContent(db, owner.guestSessionId, userId);
  }
}
