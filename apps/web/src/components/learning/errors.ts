import { ApiError } from "@/services/apiClient";

export type LearningErrorKind = "limit" | "quota" | "unavailable" | "generic";

/** Map a generation failure to a localized-error key (§10.5/§10.6 states). */
export function learningErrorKind(err: unknown): LearningErrorKind {
  if (err instanceof ApiError) {
    if (err.code === "ai_limit_reached") return "limit";
    if (err.code === "quota_exhausted") return "quota";
    if (err.code === "ai_unavailable") return "unavailable";
  }
  return "generic";
}
