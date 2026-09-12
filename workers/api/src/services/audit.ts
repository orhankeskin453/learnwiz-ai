/**
 * Audit events (CLAUDE.md §40.16/§47.15): immutable, structured records for
 * auth-relevant state changes. NEVER store passwords, raw tokens, or secrets —
 * ids and event metadata only.
 */
import { randomHex } from "./sessionCrypto";

export interface AuditEntry {
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function writeAudit(db: D1Database, entry: AuditEntry): Promise<void> {
  await db
    .prepare(
      "INSERT INTO audit_events (id, actor_user_id, action, resource_type, resource_id, request_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      randomHex(16),
      entry.actorUserId ?? null,
      entry.action,
      entry.resourceType ?? null,
      entry.resourceId ?? null,
      entry.requestId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      new Date().toISOString(),
    )
    .run();
}
