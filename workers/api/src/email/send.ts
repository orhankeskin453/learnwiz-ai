import type { Locale } from "@learwizai/types";
import type { Env } from "../env";
import { deliverEmail, queueEmail } from "./outbox";
import { getEmailProvider, type EmailMessage } from "./provider";
import { renderTemplate } from "./templates";

/** Sender identity as configuration (§47.12) — never hardcoded per feature. */
export function emailFrom(env: Env): string | null {
  return env.EMAIL_FROM_ADDRESS ?? null;
}

/** SPA origin for email links (spec D12): APP_ORIGIN overrides env defaults. */
export function emailOrigin(env: Env): string {
  if (env.APP_ORIGIN) return env.APP_ORIGIN.replace(/\/$/, "");
  if (env.ENVIRONMENT === "staging")
    return "https://learwizai-api-staging.orhankeskinn1.workers.dev";
  return "https://learwizai-api.orhankeskinn1.workers.dev";
}

export interface AuthEmailInput {
  eventType: EmailMessage["eventType"];
  templateKey: string;
  userId: string | null;
  to: string;
  locale: Locale;
  url: string;
}

/** Render → outbox row → provider attempt. Send failures never throw (§47.13). */
export async function sendAuthEmail(
  env: Env,
  db: D1Database,
  input: AuthEmailInput,
): Promise<void> {
  const content = renderTemplate(input.templateKey, input.locale, {
    url: input.url,
    email: input.to,
  });
  const message: EmailMessage = {
    eventType: input.eventType,
    templateKey: input.templateKey,
    userId: input.userId,
    from: emailFrom(env),
    to: input.to,
    locale: input.locale,
    subject: content.subject,
    html: content.html,
    text: content.text,
  };
  const provider = getEmailProvider(env);
  const eventId = await queueEmail(db, message, provider.name);
  await deliverEmail(db, provider, eventId, message);
}
