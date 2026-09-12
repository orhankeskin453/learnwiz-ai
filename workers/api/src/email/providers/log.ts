import type { EmailMessage, EmailProvider, EmailSendResult } from "../provider";

/**
 * Default provider: records the send into Workers Logs and succeeds. Pair with
 * the outbox (§47.13) so tests and staging inspect `email_events` instead of a
 * real inbox. Never used for real delivery.
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = "log";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.log("email_send", {
      eventType: message.eventType,
      templateKey: message.templateKey,
      to: message.to,
      locale: message.locale,
      subject: message.subject,
    });
    return { providerMessageId: `log-${crypto.randomUUID()}` };
  }
}
