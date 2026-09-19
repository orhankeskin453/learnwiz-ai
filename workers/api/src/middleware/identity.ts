import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { AppEnv } from "../context";
import {
  GUEST_COOKIE_NAME,
  getGuestSession,
  isActive,
  type GuestSessionRow,
} from "../services/guestSessions";
import { verifyGuestCookie } from "../services/sessionCrypto";
import { findUserById } from "../services/users";
import { resolveSession, SESSION_COOKIE_NAME } from "../services/sessions";
import { ConfigError, type Identity } from "../services/identity";

export type GuestResolution =
  { status: "absent" } | { status: "invalid" } | { status: "active"; session: GuestSessionRow };

/**
 * The placeholder from `.dev.vars.example` — rejected so copying the example
 * verbatim cannot ship a publicly-known HMAC key (spec D4 hardening).
 */
const PLACEHOLDER_SECRET = "replace-with-64-hex-chars-per-env";

export function isUsableSecret(secret: string | undefined): secret is string {
  return secret !== undefined && secret.length >= 32 && secret !== PLACEHOLDER_SECRET;
}

/** Runtime secret check — guest endpoints fail closed (spec D4) when unset/unsafe. */
export function requireSecret(env: AppEnv["Bindings"]): string {
  const secret = env.GUEST_SESSION_SECRET;
  if (!isUsableSecret(secret)) {
    throw new ConfigError("GUEST_SESSION_SECRET is missing, too short, or the example placeholder");
  }
  return secret;
}

/** Client IP for throttling. Cloudflare always sets CF-Connecting-IP; anything
 * else falls into one shared "unknown" bucket — fail-safe, never spoofable. */
export function clientIp(c: Context<AppEnv>): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

/**
 * Identity resolution (CLAUDE.md §22/§33/§40.2): classifies every /api request.
 * Precedence: active user session > guest session > anonymous. Suspended or
 * deleted accounts fall back to anonymous even with a valid session (§40.8).
 * Absent/invalid cookies never throw — guest routes branch on the resolution.
 * /api/health is skipped: probes carry no identity and must stay dependency-free.
 */
export async function identityMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  if (c.req.path === "/api/health") {
    await next();
    return;
  }

  // 1. Authenticated session (Step 4).
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionCookie) {
    const resolved = await resolveSession(c.env.DB, sessionCookie);
    if (resolved) {
      const user = await findUserById(c.env.DB, resolved.userId);
      if (user && user.status === "active") {
        c.set("identity", {
          kind: "user",
          userId: resolved.userId,
          sessionId: resolved.sessionId,
          role: user.role,
        });
        c.set("guestResolution", { status: "absent" });
        await next();
        return;
      }
    }
  }

  // 2. Guest session (Step 3).
  let resolution: GuestResolution = { status: "absent" };
  const secret = c.env.GUEST_SESSION_SECRET;
  if (isUsableSecret(secret)) {
    const value = getCookie(c, GUEST_COOKIE_NAME);
    if (value) {
      const id = await verifyGuestCookie(value, secret);
      const row = id ? await getGuestSession(c.env.DB, id) : null;
      resolution =
        row && isActive(row) ? { status: "active", session: row } : { status: "invalid" };
    }
  }

  const identity: Identity =
    resolution.status === "active"
      ? { kind: "guest", sessionId: resolution.session.id }
      : { kind: "anonymous" };
  c.set("identity", identity);
  c.set("guestResolution", resolution);
  await next();
}
