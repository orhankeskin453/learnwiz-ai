import type { Context } from "hono";
import type { Feature } from "@learwizai/types";
import type { AppEnv } from "../context";
import { clientIp } from "./identity";
import { enforceWindow } from "../services/rateLimit";
import { countUserAiUsageToday, countUserQuizUsageThisMonth } from "../services/ai/usage";
import { getGuestUsage } from "../services/guestSessions";
import { FREE_DAILY_AI_LIMIT, GUEST_ENTITLEMENTS } from "../services/entitlements";

export type AiTaskType = "tutor" | "learn" | "practice" | "quiz";

/** Task type → guest_usage feature counter (tutor is handled by the tutor route). */
const FEATURE_BY_TASK: Record<Exclude<AiTaskType, "tutor">, Feature> = {
  learn: "learn_mode",
  practice: "practice",
  quiz: "quiz",
};

/**
 * Shared AI budget gate (CLAUDE.md §33/§5.1/§10.10/§32): guests burn
 * per-feature counters, authenticated Free users draw from the shared daily
 * AI-message pool (quiz additionally capped monthly). Returns the 403/429
 * response when the budget is exhausted, or null to proceed.
 */
export async function enforceAiBudget(
  c: Context<AppEnv>,
  taskType: Exclude<AiTaskType, "tutor">,
  units: number,
): Promise<Response | null> {
  const throttle = await enforceWindow(
    c.env.CACHE,
    { bucket: "ai-gen", key: clientIp(c), max: 20, windowSeconds: 3600 },
    c.env.GUEST_SESSION_SECRET ?? "tutor-throttle-pepper",
  );
  if (!throttle) {
    return c.json({ error: "rate_limited" } satisfies { error: "rate_limited" }, 429);
  }

  const identity = c.get("identity");
  if (identity.kind === "guest") {
    const feature = FEATURE_BY_TASK[taskType];
    const used = (await getGuestUsage(c.env.DB, identity.sessionId))[feature];
    if (used + units > GUEST_ENTITLEMENTS[feature]) {
      return c.json({ error: "quota_exhausted" } satisfies { error: "quota_exhausted" }, 403);
    }
    return null;
  }
  if (identity.kind !== "user") {
    // Routes already reject anonymous callers; keep the guard for safety.
    return c.json({ error: "unauthenticated" } satisfies { error: "unauthenticated" }, 401);
  }
  if ((await countUserAiUsageToday(c.env.DB, identity.userId)) >= FREE_DAILY_AI_LIMIT) {
    return c.json({ error: "ai_limit_reached" } satisfies { error: "ai_limit_reached" }, 403);
  }
  if (taskType === "quiz") {
    if ((await countUserQuizUsageThisMonth(c.env.DB, identity.userId)) >= 5) {
      return c.json({ error: "quota_exhausted" } satisfies { error: "quota_exhausted" }, 403);
    }
  }
  return null;
}
