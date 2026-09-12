import { describe, expect, it } from "vitest";
import {
  budgetOutcome,
  buildGuestSessionResponse,
  buildUsage,
  GUEST_ENTITLEMENTS,
  getEntitlements,
} from "../src/services/entitlements";

describe("guest entitlements (§5.1 matrix)", () => {
  it("matches the CLAUDE.md §5.1 defaults exactly", () => {
    expect(GUEST_ENTITLEMENTS).toEqual({
      ai_tutor: 3,
      learn_mode: 1,
      practice: 3,
      quiz: 1,
    });
  });

  it("grants guests the matrix and anonymous nothing", () => {
    expect(getEntitlements({ kind: "guest", sessionId: "s" })).toEqual(GUEST_ENTITLEMENTS);
    expect(getEntitlements({ kind: "anonymous" })).toEqual({
      ai_tutor: 0,
      learn_mode: 0,
      practice: 0,
      quiz: 0,
    });
  });

  it("budgetOutcome allows under-budget usage and exhausts at the limit", () => {
    const used = { ai_tutor: 3, learn_mode: 0, practice: 2, quiz: 0 };
    expect(budgetOutcome(GUEST_ENTITLEMENTS, used, "ai_tutor")).toEqual({
      allowed: false,
      reason: "entitlement_exhausted",
    });
    expect(budgetOutcome(GUEST_ENTITLEMENTS, used, "practice")).toEqual({ allowed: true });
    expect(budgetOutcome(GUEST_ENTITLEMENTS, used, "learn_mode")).toEqual({ allowed: true });
  });

  it("builds the API usage snapshot and response body", () => {
    const used = { ai_tutor: 1, learn_mode: 1, practice: 0, quiz: 0 };
    expect(buildUsage(GUEST_ENTITLEMENTS, used)).toEqual([
      { feature: "ai_tutor", used: 1, limit: 3 },
      { feature: "learn_mode", used: 1, limit: 1 },
      { feature: "practice", used: 0, limit: 3 },
      { feature: "quiz", used: 0, limit: 1 },
    ]);

    const body = buildGuestSessionResponse(GUEST_ENTITLEMENTS, used, "2026-09-19T00:00:00.000Z");
    expect(body.expiresAt).toBe("2026-09-19T00:00:00.000Z");
    expect(body.usage).toHaveLength(4);
  });
});
