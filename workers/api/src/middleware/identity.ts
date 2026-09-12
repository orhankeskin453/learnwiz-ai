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
import type { Identity } from "../services/identity";

export type GuestResolution =
  { status: "absent" } | { status: "invalid" } | { status: "active"; session: GuestSessionRow };

/** Runtime secret check — routes fail closed (spec D4) when unset or unsafe. */
export function requireSecret(env: AppEnv["Bindings"]): string {
  const secret = env.GUEST_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("GUEST_SESSION_SECRET is missing or shorter than 32 characters");
  }
  return secret;
}

/**
 * Identity resolution (CLAUDE.md §22/§33): classifies every /api request.
 * Absent/invalid cookies never throw here — guest routes branch on the stored
 * resolution; everything else just sees `anonymous`. Authenticated resolution
 * (users/sessions tables) plugs in at the auth step (§48 item 6).
 */
export async function identityMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  let resolution: GuestResolution = { status: "absent" };
  const secret = c.env.GUEST_SESSION_SECRET;
  if (secret && secret.length >= 32) {
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
