/**
 * Transactional email outbox (CLAUDE.md §47.13): the state change commits first,
 * the outbox row is written, THEN the provider is attempted — a send failure
 * never breaks the request path and is recorded for retry/inspection.
 */
import { randomHex } from "../services/sessionCrypto";
import type { EmailMessage, EmailProvider } from "./provider";

export async function queueEmail(
  db: D1Database,
  message: EmailMessage,
  providerName: string,
): Promise<string> {
  const id = randomHex(16);
  await db
    .prepare(
      "INSERT INTO email_events (id, event_type, user_id, recipient, locale, template_key, status, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)",
    )
    .bind(
      id,
      message.eventType,
      message.userId,
      message.to,
      message.locale,
      message.templateKey,
      providerName,
      new Date().toISOString(),
    )
    .run();
  return id;
}

export async function deliverEmail(
  db: D1Database,
  provider: EmailProvider,
  eventId: string,
  message: EmailMessage,
): Promise<void> {
  try {
    const result = await provider.send(message);
    await db
      .prepare(
        "UPDATE email_events SET status = 'sent', provider_message_id = ?, sent_at = ? WHERE id = ?",
      )
      .bind(result.providerMessageId ?? null, new Date().toISOString(), eventId)
      .run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await db
      .prepare(
        "UPDATE email_events SET status = 'failed', attempt_count = attempt_count + 1, last_error = ? WHERE id = ?",
      )
      .bind(detail.slice(0, 500), eventId)
      .run();
    console.error("email_deliver_failed", { eventId, templateKey: message.templateKey });
  }
}
