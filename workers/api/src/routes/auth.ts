import { Hono, type Context } from "hono";
import type { AuthSessionResponse, GenericAuthResponse, UserProfile } from "@learwizai/types";
import {
  loginSchema,
  registerSchema,
  resetConfirmSchema,
  resetRequestSchema,
  verifyEmailSchema,
} from "@learwizai/validation";
import type { AppEnv } from "../context";
import { sendAuthEmail, emailOrigin } from "../email/send";
import { buildSessionSetCookie, clearSessionCookie } from "../services/cookies";
import { hashPassword, passwordIterations, verifyPassword } from "../services/passwords";
import { enforceWindow } from "../services/rateLimit";
import { revokeAllSessions, revokeSession, createSession } from "../services/sessions";
// requireSecret intentionally unused here — guest routes enforce it; auth throttles self-contain
import { createAuthToken, consumeAuthToken } from "../services/tokens";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getPasswordHashById,
  markEmailVerified,
  updatePasswordHash,
} from "../services/users";
import { setMigrationStatus } from "../services/guestSessions";
import { migrateGuestContent } from "../services/migration";
import { writeAudit } from "../services/audit";

/**
 * Auth endpoints (CLAUDE.md §47.2, §40.2). Anti-enumeration: register and
 * password-reset responses are identical whether or not the email exists (§40.9).
 * All endpoints are rate-limited (§47.14) and audited (§40.16).
 */
export const authRoute = new Hono<AppEnv>();

const THROTTLE_PEPPER_FALLBACK = "auth-throttle-pepper";

async function limited(
  c: Context<AppEnv>,
  bucket: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<Response | null> {
  const allowed = await enforceWindow(
    c.env.CACHE,
    { bucket, key, max, windowSeconds },
    c.env.GUEST_SESSION_SECRET ?? THROTTLE_PEPPER_FALLBACK,
  );
  if (allowed) return null;
  return c.json({ error: "rate_limited" } satisfies { error: "rate_limited" }, 429);
}

function toProfile(row: NonNullable<Awaited<ReturnType<typeof findUserById>>>): UserProfile {
  return {
    id: row.id,
    email: row.email,
    locale: row.locale,
    status: row.status,
    emailVerified: row.emailVerifiedAt !== null,
    createdAt: row.createdAt,
  };
}

function clientIp(c: Context<AppEnv>): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

/** Guest migration hook (spec D10 / §5.2): content migration lands with AI Tutor. */
async function migrateGuestSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const resolution = c.get("guestResolution");
  if (resolution.status === "active") {
    await setMigrationStatus(c.env.DB, resolution.session.id, "migrated");
    await writeAudit(c.env.DB, {
      actorUserId: userId,
      action: "guest_migration_completed",
      resourceType: "guest_session",
      resourceId: resolution.session.id,
      requestId: c.get("requestId"),
    });
  }
}

authRoute.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: parsed.error.issues[0]?.message } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const throttle = await limited(c, "register", clientIp(c), 5, 3600);
  if (throttle) return throttle;

  const { email, password } = parsed.data;
  // Single PBKDF2 evaluation BEFORE the existence branch — the expensive crypto
  // work is identical for both paths so timing cannot enumerate emails (§40.9).
  const passwordHash = await hashPassword(password, passwordIterations(c.env));
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing) {
    return c.json({ ok: true } satisfies GenericAuthResponse, 201);
  }

  const user = await createUser(c.env.DB, {
    email,
    emailNormalized: email,
    passwordHash,
  });
  const { token } = await createAuthToken(c.env.DB, user.id, "email_verification");
  await sendAuthEmail(c.env, c.env.DB, {
    eventType: "verification",
    templateKey: "verification",
    userId: user.id,
    to: user.email,
    locale: user.locale,
    url: `${emailOrigin(c.env)}/en/auth/verify?token=${token}`,
  });
  await writeAudit(c.env.DB, {
    action: "signup_started",
    resourceType: "user",
    resourceId: user.id,
    requestId: c.get("requestId"),
    metadata: { locale: user.locale },
  });
  await writeAudit(c.env.DB, {
    actorUserId: user.id,
    action: "email_verification_sent",
    requestId: c.get("requestId"),
  });
  return c.json({ ok: true } satisfies GenericAuthResponse, 201);
});

authRoute.post("/verify-email", async (c) => {
  const parsed = verifyEmailSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid token format" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const throttle = await limited(c, "verify", clientIp(c), 10, 3600);
  if (throttle) return throttle;

  const consumed = await consumeAuthToken(c.env.DB, parsed.data.token, "email_verification");
  if (!consumed) {
    return c.json({ error: "invalid_token" } satisfies { error: "invalid_token" }, 400);
  }
  const user = await findUserById(c.env.DB, consumed.userId);
  if (!user || user.status === "suspended" || user.status === "deleted") {
    return c.json({ error: "invalid_token" } satisfies { error: "invalid_token" }, 400);
  }
  await markEmailVerified(c.env.DB, user.id);
  const { token: sessionToken } = await createSession(c.env.DB, user.id);
  // §5.2 full content migration (conversations/lessons/quizzes), then the audit hook.
  const resolution = c.get("guestResolution");
  if (resolution.status === "active") {
    await migrateGuestContent(c.env.DB, resolution.session.id, user.id);
  }
  await migrateGuestSession(c, user.id);
  await sendAuthEmail(c.env, c.env.DB, {
    eventType: "welcome",
    templateKey: "welcome",
    userId: user.id,
    to: user.email,
    locale: user.locale,
    url: emailOrigin(c.env),
  });
  await writeAudit(c.env.DB, {
    actorUserId: user.id,
    action: "email_verified",
    requestId: c.get("requestId"),
  });
  await writeAudit(c.env.DB, {
    actorUserId: user.id,
    action: "signup_completed",
    requestId: c.get("requestId"),
  });

  const fresh = await findUserById(c.env.DB, user.id);
  const body: AuthSessionResponse = { user: toProfile(fresh ?? user) };
  c.header("Set-Cookie", buildSessionSetCookie(c.env, sessionToken));
  return c.json(body);
});

authRoute.post("/resend-verification", async (c) => {
  const parsed = resetRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid email" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const throttle = await limited(c, "resend", parsed.data.email, 3, 3600);
  if (throttle) return throttle;

  // Generic response regardless of account state (§40.9).
  const user = await findUserByEmail(c.env.DB, parsed.data.email);
  if (user && user.status === "pending") {
    const { token } = await createAuthToken(c.env.DB, user.id, "email_verification");
    await sendAuthEmail(c.env, c.env.DB, {
      eventType: "verification",
      templateKey: "verification",
      userId: user.id,
      to: user.email,
      locale: user.locale,
      url: `${emailOrigin(c.env)}/en/auth/verify?token=${token}`,
    });
    await writeAudit(c.env.DB, {
      actorUserId: user.id,
      action: "email_verification_sent",
      requestId: c.get("requestId"),
    });
  }
  return c.json({ ok: true } satisfies GenericAuthResponse);
});

authRoute.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid email or password" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const throttle = await limited(c, "login", `${clientIp(c)}:${parsed.data.email}`, 10, 3600);
  if (throttle) return throttle;

  const user = await findUserByEmail(c.env.DB, parsed.data.email);
  if (!user) {
    // Equalize timing against the hash-verify path (§40.9).
    await hashPassword(parsed.data.password, passwordIterations(c.env));
    await writeAudit(c.env.DB, {
      action: "login_failed",
      requestId: c.get("requestId"),
      metadata: { reason: "unknown_email" },
    });
    return c.json({ error: "invalid_credentials" } satisfies { error: "invalid_credentials" }, 401);
  }
  const storedHash = await getPasswordHashById(c.env.DB, user.id);
  const valid = storedHash !== null && (await verifyPassword(parsed.data.password, storedHash));
  if (!valid) {
    await writeAudit(c.env.DB, {
      actorUserId: user.id,
      action: "login_failed",
      requestId: c.get("requestId"),
      metadata: { reason: "bad_password" },
    });
    return c.json({ error: "invalid_credentials" } satisfies { error: "invalid_credentials" }, 401);
  }
  if (user.status === "pending") {
    return c.json({ error: "email_not_verified" } satisfies { error: "email_not_verified" }, 403);
  }
  if (user.status !== "active") {
    return c.json({ error: "account_suspended" } satisfies { error: "account_suspended" }, 403);
  }

  const { token } = await createSession(c.env.DB, user.id);
  // §5.2: login with a guest cookie migrates the guest's content to the account.
  const loginOwner: { userId: string | null; guestSessionId: string | null } = {
    userId: user.id,
    guestSessionId: null,
  };
  const guestCookieValue = (c.req.header("cookie") ?? "").match(
    /learwiz_guest_session=([^;]+)/,
  )?.[1];
  if (guestCookieValue) {
    const { verifyGuestCookie } = await import("../services/sessionCrypto");
    const { getGuestSession, isActive } = await import("../services/guestSessions");
    const secret = c.env.GUEST_SESSION_SECRET;
    if (secret && secret.length >= 32) {
      const guestId = await verifyGuestCookie(guestCookieValue, secret);
      const row = guestId ? await getGuestSession(c.env.DB, guestId) : null;
      if (row && isActive(row)) {
        await migrateGuestContent(c.env.DB, row.id, user.id);
        loginOwner.guestSessionId = row.id;
      }
    }
  }
  await writeAudit(c.env.DB, {
    actorUserId: user.id,
    action: "login_success",
    requestId: c.get("requestId"),
  });
  c.header("Set-Cookie", buildSessionSetCookie(c.env, token));
  const body: AuthSessionResponse = { user: toProfile(user) };
  return c.json(body);
});

authRoute.post("/logout", async (c) => {
  const identity = c.get("identity");
  if (identity.kind !== "user") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  await revokeSession(c.env.DB, identity.sessionId);
  await writeAudit(c.env.DB, {
    actorUserId: identity.userId,
    action: "session_revoked",
    resourceType: "session",
    resourceId: identity.sessionId,
    requestId: c.get("requestId"),
  });
  await writeAudit(c.env.DB, {
    actorUserId: identity.userId,
    action: "logout",
    requestId: c.get("requestId"),
  });
  c.header("Set-Cookie", clearSessionCookie(c.env));
  return c.body(null, 204);
});

authRoute.get("/me", async (c) => {
  const identity = c.get("identity");
  if (identity.kind !== "user") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const user = await findUserById(c.env.DB, identity.userId);
  if (!user) {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  const body: UserProfile = toProfile(user);
  return c.json(body);
});

authRoute.post("/request-password-reset", async (c) => {
  const parsed = resetRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid email" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  const throttle = await limited(c, "reset-request", parsed.data.email, 3, 3600);
  if (throttle) return throttle;

  // Generic response whether or not the account exists (§40.9).
  const user = await findUserByEmail(c.env.DB, parsed.data.email);
  if (user && user.status !== "deleted") {
    const { token } = await createAuthToken(c.env.DB, user.id, "password_reset");
    await sendAuthEmail(c.env, c.env.DB, {
      eventType: "password_reset",
      templateKey: "password_reset",
      userId: user.id,
      to: user.email,
      locale: user.locale,
      url: `${emailOrigin(c.env)}/en/auth/reset-password?token=${token}`,
    });
    await writeAudit(c.env.DB, {
      actorUserId: user.id,
      action: "password_reset_requested",
      requestId: c.get("requestId"),
    });
  }
  return c.json({ ok: true } satisfies GenericAuthResponse);
});

authRoute.post("/reset-password", async (c) => {
  const parsed = resetConfirmSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "invalid input" } satisfies {
        error: "validation_error";
        message?: string;
      },
      400,
    );
  }
  // CPU-cost guard: unthrottled PBKDF2 here would be a denial-of-wallet vector (§18).
  const throttle = await limited(c, "reset-confirm", clientIp(c), 10, 3600);
  if (throttle) return throttle;

  const consumed = await consumeAuthToken(c.env.DB, parsed.data.token, "password_reset");
  if (!consumed) {
    return c.json({ error: "invalid_token" } satisfies { error: "invalid_token" }, 400);
  }
  await updatePasswordHash(
    c.env.DB,
    consumed.userId,
    await hashPassword(parsed.data.password, passwordIterations(c.env)),
  );
  await revokeAllSessions(c.env.DB, consumed.userId);
  await writeAudit(c.env.DB, {
    actorUserId: consumed.userId,
    action: "session_revoked",
    resourceType: "session",
    requestId: c.get("requestId"),
    metadata: { scope: "all", reason: "password_reset" },
  });
  await writeAudit(c.env.DB, {
    actorUserId: consumed.userId,
    action: "password_reset_completed",
    requestId: c.get("requestId"),
  });
  return c.json({ ok: true } satisfies GenericAuthResponse);
});
