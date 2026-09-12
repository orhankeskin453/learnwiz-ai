import type { EmailMessage, EmailProvider, EmailSendResult } from "../provider";

/**
 * Default provider: records the send into Workers Logs and succeeds. Pair with
 * the outbox (§47.13) so tests and staging inspect `email_events` instead of a
 * real inbox. Never used for real delivery. Recipient is masked — logs are not
 * a PII surface (§47.15).
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = "log";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.log("email_send", {
      eventType: message.eventType,
      templateKey: message.templateKey,
      to: maskEmail(message.to),
      from: message.from,
      locale: message.locale,
      subject: message.subject,
    });
    return { providerMessageId: `log-${crypto.randomUUID()}` };
  }
}

/** Show only the local part's first two characters and the domain. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}
