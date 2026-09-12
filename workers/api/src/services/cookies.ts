import type { Env } from "../env";
import { GUEST_COOKIE_NAME, GUEST_SESSION_TTL_SECONDS } from "./guestSessions";

/**
 * Cookie builder (spec D2): HttpOnly + SameSite=Lax + Path=/ + 7-day Max-Age.
 * `Secure` on staging/production only — `wrangler dev` serves plain HTTP
 * locally and would drop Secure cookies.
 */
export function buildGuestSetCookie(env: Env, value: string): string {
  const secure = env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging";
  return `${GUEST_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}
