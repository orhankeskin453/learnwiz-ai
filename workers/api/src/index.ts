import { Hono } from "hono";
import type { Env } from "./env";
import { healthRoute } from "./routes/health";

// basePath keeps every route below /api/* — everything else is served by
// the static assets binding (run_worker_first in wrangler.jsonc).
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.route("/health", healthRoute);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

export default app;
