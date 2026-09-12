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

import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./sessions";

/** Auth session cookie (spec D2): HttpOnly, SameSite=Lax, 30-day Max-Age,
 * Secure on staging/production only (local dev serves plain HTTP). */
export function buildSessionSetCookie(env: Env, token: string): string {
  const secure = env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

/** Logout / session-replacement: expire the cookie immediately. */
export function clearSessionCookie(env: Env): string {
  const secure = env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
