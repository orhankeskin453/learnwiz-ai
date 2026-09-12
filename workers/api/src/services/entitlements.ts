import type { Feature, FeatureUsage, GuestSessionResponse } from "@learwizai/types";
import type { Identity } from "./identity";

/**
 * EntitlementService — centralized feature gating (CLAUDE.md §17, §34).
 *
 * Guest limits are SERVER-SIDE CONFIGURATION (§5.1: "configuration/entitlement
 * data, not frontend hardcoded rules"). Plan entitlements (Free/Learner/Pro with
 * period resets, §10.10/§11.2) plug into this module with the billing step; the
 * function shapes stay stable.
 */

/** Guest entitlement matrix — the exact §5.1 defaults. 0 = unavailable. */
export const GUEST_ENTITLEMENTS: Record<Feature, number> = {
  ai_tutor: 3,
  learn_mode: 1,
  practice: 3,
  quiz: 1,
};

const ZERO_LIMITS: Record<Feature, number> = { ai_tutor: 0, learn_mode: 0, practice: 0, quiz: 0 };

export type BudgetCheck = { allowed: true } | { allowed: false; reason: "entitlement_exhausted" };

/** Pure budget decision — unit-testable without bindings. */
export function budgetOutcome(
  limits: Record<Feature, number>,
  used: Record<Feature, number>,
  feature: Feature,
): BudgetCheck {
  return used[feature] < limits[feature]
    ? { allowed: true }
    : { allowed: false, reason: "entitlement_exhausted" };
}

/** Entitlement limits for an identity (guests get §5.1; anonymous gets nothing). */
export function getEntitlements(identity: Identity): Record<Feature, number> {
  return identity.kind === "guest" ? GUEST_ENTITLEMENTS : ZERO_LIMITS;
}

/** Build the API usage snapshot (remaining budgets are derivable client-side). */
export function buildUsage(
  limits: Record<Feature, number>,
  used: Record<Feature, number>,
): FeatureUsage[] {
  return (Object.keys(limits) as Feature[]).map((feature) => ({
    feature,
    used: used[feature],
    limit: limits[feature],
  }));
}

/** Response body for POST/GET /api/guest/session. */
export function buildGuestSessionResponse(
  limits: Record<Feature, number>,
  used: Record<Feature, number>,
  expiresAt: string,
): GuestSessionResponse {
  return { expiresAt, usage: buildUsage(limits, used) };
}

/** Free-plan daily AI limit (§10.10) — user-side counterpart of the guest matrix. */
export const FREE_DAILY_AI_LIMIT = 10;
