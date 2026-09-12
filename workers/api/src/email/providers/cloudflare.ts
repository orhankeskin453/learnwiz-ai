import type { EmailProvider, EmailSendResult } from "../provider";

/**
 * Cloudflare Email Service provider — DORMANT (spec D6): sending requires an
 * operator-verified domain (SPF/DKIM/DMARC) and a service binding; until both
 * exist this provider refuses to send and the outbox records the failure.
 * Wiring instructions: docs/runbooks/email-delivery.md.
 */
export class CloudflareEmailProvider implements EmailProvider {
  readonly name = "cloudflare";

  async send(): Promise<EmailSendResult> {
    throw new Error(
      "Cloudflare Email Service is not wired yet — verify the sending domain and configure the service binding (docs/runbooks/email-delivery.md)",
    );
  }
}
