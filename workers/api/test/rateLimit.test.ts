import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { enforceWindow } from "../src/services/rateLimit";

describe("enforceWindow (generic KV throttle, §47.14)", () => {
  it("allows up to max, then blocks within the window; keys are isolated", async () => {
    const limit = { bucket: "test", key: "user-a", max: 3, windowSeconds: 3600 };
    expect(await enforceWindow(env.CACHE, limit, "pepper")).toBe(true);
    expect(await enforceWindow(env.CACHE, limit, "pepper")).toBe(true);
    expect(await enforceWindow(env.CACHE, limit, "pepper")).toBe(true);
    expect(await enforceWindow(env.CACHE, limit, "pepper")).toBe(false);

    // Different key and different pepper are independent buckets.
    expect(await enforceWindow(env.CACHE, { ...limit, key: "user-b" }, "pepper")).toBe(true);
    expect(await enforceWindow(env.CACHE, limit, "other-pepper")).toBe(true);
  });
});
