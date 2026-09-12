/**
 * Workers AI chat client (§13.2) with a deterministic mock seam (spec D10):
 * when AI_MOCK_RESPONSES is set (tests only), canned per-model responses are
 * served instead of the real binding — CI never spends neurons or flakes.
 * v1 uses NON-STREAMING completions: Workers AI returns the full response plus
 * exact usage counts, so the §13.6 ledger records actual tokens synchronously.
 * (SSE streaming is deferred to 5b — spec D4 amendment.)
 */
import type { Env } from "../../env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatCompletion {
  text: string;
  usage: AiUsage;
}

interface MockSpec {
  behavior: "stream" | "fail";
  deltas?: string[];
  text?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export function primaryModel(env: Env): string {
  return env.AI_PRIMARY_MODEL ?? "@cf/zai-org/glm-4.7-flash";
}

export function fallbackModel(env: Env): string {
  return env.AI_FALLBACK_MODEL ?? "@cf/meta/llama-3.1-8b-instruct-fast";
}

function mockSpecs(env: Env): Record<string, MockSpec> | null {
  if (!env.AI_MOCK_RESPONSES) return null;
  return JSON.parse(env.AI_MOCK_RESPONSES) as Record<string, MockSpec>;
}

/**
 * Run a chat completion for `model`. Throws on provider failure — the router
 * decides whether to attempt the fallback model (§18).
 */
export async function runChat(
  env: Env,
  model: string,
  messages: ChatMessage[],
): Promise<ChatCompletion> {
  const specs = mockSpecs(env);
  if (specs) {
    const spec = specs[model];
    if (!spec || spec.behavior === "fail") {
      throw new Error(`mock AI failure for ${model}`);
    }
    const text = spec.text ?? (spec.deltas ?? []).join("");
    if (!spec.usage) throw new Error("mock AI spec missing usage");
    return {
      text,
      usage: {
        promptTokens: spec.usage.prompt_tokens,
        completionTokens: spec.usage.completion_tokens,
      },
    };
  }

  const result = (await env.AI.run(model, { messages })) as unknown as {
    response?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: result.response ?? "",
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
    },
  };
}
