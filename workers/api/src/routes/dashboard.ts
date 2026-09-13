import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getDashboard, getProgress } from "../services/dashboard";
import { ownerOf } from "./learn";

/** Dashboard + progress aggregates (CLAUDE.md §10.2, §10.8). */
export const dashboardRoute = new Hono<AppEnv>();

dashboardRoute.get("/", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  return c.json(await getDashboard(c.env.DB, ownerOf(c)));
});

dashboardRoute.get("/progress", async (c) => {
  const identity = c.get("identity");
  if (identity.kind === "anonymous") {
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  return c.json(await getProgress(c.env.DB, ownerOf(c)));
});
