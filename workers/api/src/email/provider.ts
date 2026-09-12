/**
 * EmailProvider abstraction (CLAUDE.md §47.4): business code never talks to a
 * concrete email service. Providers: LogEmailProvider (default — outbox only,
 * no network) and CloudflareEmailProvider (dormant until the sending domain is
 * verified by the operator — see docs/runbooks/email-delivery.md).
 */
import type { Locale } from "@learwizai/types";
import { CloudflareEmailProvider } from "./providers/cloudflare";
import { LogEmailProvider } from "./providers/log";

export type EmailEventType = "verification" | "welcome" | "password_reset" | "security";

export interface EmailMessage {
  eventType: EmailEventType;
  templateKey: string;
  userId: string | null;
  to: string;
  locale: Locale;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export function getEmailProvider(env: { EMAIL_PROVIDER?: string }): EmailProvider {
  if (env.EMAIL_PROVIDER === "cloudflare") {
    return new CloudflareEmailProvider();
  }
  return new LogEmailProvider();
}
