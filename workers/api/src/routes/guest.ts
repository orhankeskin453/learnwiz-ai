import { Hono, type Context } from "hono";
import type { GuestSessionResponse } from "@learwizai/types";
import type { AppEnv } from "../context";
import { buildGuestSetCookie } from "../services/cookies";
import { buildGuestSessionResponse, GUEST_ENTITLEMENTS } from "../services/entitlements";
import { getGuestUsage, insertGuestSession } from "../services/guestSessions";
import {
  allowGuestSessionCreation,
  RATE_LIMITED_CODE,
  windowResetInSeconds,
} from "../services/rateLimit";
import { generateGuestSessionId, signGuestCookie } from "../services/sessionCrypto";
import { requireSecret } from "../middleware/identity";

/** Guest session endpoints (CLAUDE.md §5, §22 — /guest/* route group). */
export const guestRoute = new Hono<AppEnv>();

function clientIp(c: Context<AppEnv>): string {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

guestRoute.post("/", async (c) => {
  const secret = requireSecret(c.env); // throws → onError maps to 500 config_error

  const allowed = await allowGuestSessionCreation(c.env.CACHE, clientIp(c), secret);
  if (!allowed) {
    return c.json({ error: RATE_LIMITED_CODE } satisfies { error: typeof RATE_LIMITED_CODE }, 429, {
      "Retry-After": String(windowResetInSeconds()),
    });
  }

  // Idempotent reuse: a valid, active session is returned unchanged (spec §5).
  const resolution = c.get("guestResolution");
  if (resolution.status === "active") {
    const body = buildGuestSessionResponse(
      GUEST_ENTITLEMENTS,
      await getGuestUsage(c.env.DB, resolution.session.id),
      resolution.session.expiresAt,
    );
    return c.json(body);
  }

  // Absent OR invalid/expired/migrated → recover by creating a fresh session.
  const id = generateGuestSessionId();
  const row = await insertGuestSession(c.env.DB, id);
  const signed = await signGuestCookie(id, secret);
  c.header("Set-Cookie", buildGuestSetCookie(c.env, signed));
  const body: GuestSessionResponse = buildGuestSessionResponse(
    GUEST_ENTITLEMENTS,
    await getGuestUsage(c.env.DB, row.id),
    row.expiresAt,
  );
  return c.json(body, 201);
});

guestRoute.get("/", async (c) => {
  requireSecret(c.env);
  const resolution = c.get("guestResolution");
  if (resolution.status === "absent") {
    return c.json(
      { error: "guest_session_not_found" } satisfies { error: "guest_session_not_found" },
      404,
    );
  }
  if (resolution.status === "invalid") {
    return c.json(
      { error: "guest_session_invalid" } satisfies { error: "guest_session_invalid" },
      401,
    );
  }
  const body = buildGuestSessionResponse(
    GUEST_ENTITLEMENTS,
    await getGuestUsage(c.env.DB, resolution.session.id),
    resolution.session.expiresAt,
  );
  return c.json(body);
});
