import { Hono } from "hono";
import type { ApiErrorBody } from "@learwizai/types";
import type { AppEnv } from "./context";
import { identityMiddleware } from "./middleware/identity";
import { guestRoute } from "./routes/guest";
import { healthRoute } from "./routes/health";

// basePath keeps every route below /api/* — everything else is served by
// the static assets binding (run_worker_first in wrangler.jsonc).
const app = new Hono<AppEnv>().basePath("/api");

// §22 middleware order: identity resolution runs before every handler.
app.use("*", identityMiddleware);

app.route("/health", healthRoute);
app.route("/guest/session", guestRoute);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

app.onError((err, c) => {
  if (err.name === "ConfigError") {
    // Fail closed without leaking WHICH value is missing (§23 errors).
    const body: ApiErrorBody = { error: "config_error" };
    return c.json(body, 500);
  }
  console.error("unhandled_error", {
    path: c.req.path,
    errorName: err.name,
    message: err.message,
  });
  const body: ApiErrorBody = { error: "internal_error" };
  return c.json(body, 500);
});

export default app;
