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
  } catch {
    const fallback = fallbackModel(env);
    return { ...(await runChat(env, fallback, messages)), model: fallback, fallback: true };
  }
}
