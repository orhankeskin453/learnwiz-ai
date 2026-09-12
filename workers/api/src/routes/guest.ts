import { Hono } from "hono";
import type { GuestSessionResponse } from "@learwizai/types";
import type { AppEnv } from "../context";
import { buildGuestSetCookie } from "../services/cookies";
import { buildGuestSessionResponse, GUEST_ENTITLEMENTS } from "../services/entitlements";
import { getGuestUsage, insertGuestSession } from "../services/guestSessions";
import { generateGuestSessionId, signGuestCookie } from "../services/sessionCrypto";
import { requireSecret } from "../middleware/identity";

/** Guest session endpoints (CLAUDE.md §5, §22 — /guest/* route group).
 * Throttling runs earlier, in guestCreateThrottle (§22: security → identity). */
export const guestRoute = new Hono<AppEnv>();

guestRoute.post("/", async (c) => {
  const secret = requireSecret(c.env); // throws → onError maps to 500 config_error

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
