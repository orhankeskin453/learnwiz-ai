/**
 * AI Router v1 (CLAUDE.md §13.1 + §18): tutor traffic goes to the primary model
 * with exactly ONE approved fallback attempt on provider failure — no blind
 * retries, no amplification. Model names are env-tunable (§34 AIRouter seam).
 */
import type { Env } from "../../env";
import {
  fallbackModel,
  runChat,
  primaryModel,
  type ChatCompletion,
  type ChatMessage,
} from "./client";

export interface RoutedCompletion extends ChatCompletion {
  model: string;
  fallback: boolean;
}

export async function runTutorCompletion(
  env: Env,
  messages: ChatMessage[],
): Promise<RoutedCompletion> {
  const primary = primaryModel(env);
  try {
    return { ...(await runChat(env, primary, messages)), model: primary, fallback: false };
  } catch (primaryError) {
    // §20 observability: model failures must be visible in Workers Logs.
    console.error("ai_primary_failed", {
      model: primary,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });
    const fallback = fallbackModel(env);
    try {
      return { ...(await runChat(env, fallback, messages)), model: fallback, fallback: true };
    } catch (fallbackError) {
      console.error("ai_fallback_failed", {
        model: fallback,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
      throw fallbackError;
    }
  }
}
