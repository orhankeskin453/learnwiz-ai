import type { Next } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../context";

/** Per-request correlation id for Workers Logs (§22 first stage, §20). */
export async function requestIdMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("X-Request-Id", requestId);
}
