import type { Context, Next } from "hono";
import type { AppEnv } from "../context";
import { clientIp, requireSecret } from "./identity";
import {
  allowGuestSessionCreation,
  RATE_LIMITED_CODE,
  windowResetInSeconds,
} from "../services/rateLimit";

/**
 * Per-IP throttle for guest session creation (§18) — runs BEFORE identity
 * resolution (§22 order: security checks → identity). GET passes through;
 * the handler re-checks the secret itself.
 */
export async function guestCreateThrottle(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  if (c.req.method !== "POST") return next();

  const secret = requireSecret(c.env);
  const allowed = await allowGuestSessionCreation(c.env.CACHE, clientIp(c), secret);
  if (!allowed) {
    return c.json({ error: RATE_LIMITED_CODE } satisfies { error: typeof RATE_LIMITED_CODE }, 429, {
      "Retry-After": String(windowResetInSeconds()),
    });
  }
  await next();
}
