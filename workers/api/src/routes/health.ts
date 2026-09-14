import { Hono } from "hono";
import type { HealthResponse } from "@learwizai/types";
import type { Env } from "../env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/", async (c) => {
  let db: HealthResponse["checks"]["db"] = "ok";
  try {
    // SELECT 1 works on an empty database — proves the binding is live.
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    db = "unavailable";
  }

  const body: HealthResponse = {
    status: "ok",
    service: "learnwizai-api",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    checks: { db },
  };
  return c.json(body);
});
