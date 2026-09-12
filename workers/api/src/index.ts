import { Hono } from "hono";
import type { ApiErrorBody } from "@learwizai/types";
import type { AppEnv } from "./context";
import { guestCreateThrottle } from "./middleware/guestThrottle";
import { identityMiddleware } from "./middleware/identity";
import { requestIdMiddleware } from "./middleware/requestId";
import { guestRoute } from "./routes/guest";
import { authRoute } from "./routes/auth";
import { tutorRoute } from "./routes/tutor";
import { healthRoute } from "./routes/health";
import { ConfigError } from "./services/identity";

// basePath keeps every route below /api/* — everything else is served by
// the static assets binding (run_worker_first in wrangler.jsonc).
const app = new Hono<AppEnv>().basePath("/api");

// §22 middleware order: request id → security checks → identity resolution.
app.use("*", requestIdMiddleware);
app.use("/guest/session", guestCreateThrottle);
app.use("*", identityMiddleware);

app.route("/health", healthRoute);
app.route("/guest/session", guestRoute);
app.route("/auth", authRoute);
app.route("/tutor", tutorRoute);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

app.onError((err, c) => {
  if (err instanceof ConfigError) {
    // Fail closed without logging WHICH value is missing (§23 errors).
    const body: ApiErrorBody = { error: "config_error" };
    return c.json(body, 500);
  }
  console.error("unhandled_error", {
    requestId: c.get("requestId"),
    path: c.req.path,
    errorName: err.name,
    message: err.message,
  });
  const body: ApiErrorBody = { error: "internal_error" };
  return c.json(body, 500);
});

export default app;
