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
  /** Actual neuron cost when the provider reports it (§14). */
  neurons?: number;
}

export interface ChatCompletion {
  text: string;
  usage: AiUsage;
  /** False when the provider omitted usage — the ledger flags the row estimated (§13.6). */
  usageProvided: boolean;
}

interface MockMatcher {
  ifSystemContains: string;
  text: string;
}

interface MockSpec {
  behavior: "stream" | "fail";
  deltas?: string[];
  text?: string;
  /** Structured-generation fixtures: pick output by a marker in the system prompt. */
  match?: MockMatcher[];
  defaultText?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export function primaryModel(env: Env): string {
  return env.AI_PRIMARY_MODEL ?? "@cf/zai-org/glm-4.7-flash";
}

export function fallbackModel(env: Env): string {
  return env.AI_FALLBACK_MODEL ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

function mockSpecs(env: Env): Record<string, MockSpec> | null {
  if (!env.AI_MOCK_RESPONSES) return null;
  return JSON.parse(env.AI_MOCK_RESPONSES) as Record<string, MockSpec>;
}

/**
 * Run a chat completion for `model`. Throws on provider failure — the router
 * decides whether to attempt the fallback model (§18).
 */
export interface ChatRunOptions {
  /** Output cap — structured generation needs headroom (truncation breaks JSON). */
  maxTokens?: number;
  /** Lower temperature keeps JSON/schema adherence high. */
  temperature?: number;
}

export async function runChat(
  env: Env,
  model: string,
  messages: ChatMessage[],
  options: ChatRunOptions = {},
): Promise<ChatCompletion> {
  const specs = mockSpecs(env);
  if (specs) {
    const spec = specs[model];
    if (!spec || spec.behavior === "fail") {
      throw new Error(`mock AI failure for ${model}`);
    }
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const matcher = spec.match?.find((m) => system.includes(m.ifSystemContains));
    const text = matcher?.text ?? spec.text ?? spec.defaultText ?? (spec.deltas ?? []).join("");
    if (!spec.usage) throw new Error("mock AI spec missing usage");
    return {
      text,
      usageProvided: true,
      usage: {
        promptTokens: spec.usage.prompt_tokens,
        completionTokens: spec.usage.completion_tokens,
      },
    };
  }

  const result = (await env.AI.run(model, {
    messages,
    ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
  })) as unknown as {
    // Legacy Workers AI shape: { response }
    response?: string;
    // OpenAI-compatible shape (e.g. @cf/zai-org/glm-4.7-flash): { choices, usage }
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; neurons?: number };
  };
  // Model families differ in response shape — support both (§20 logs anomalies).
  const openAiContent = result.choices?.[0]?.message?.content ?? result.choices?.[0]?.text;
  const text = result.response ?? openAiContent ?? "";
  // An empty answer is a provider failure, not a success (§18: fall back).
  if (!text) {
    console.error("ai_empty_response", {
      model,
      keys: Object.keys(result ?? {}).join(","),
      usage: JSON.stringify(result.usage ?? {}),
    });
    throw new Error(`model ${model} returned an empty response`);
  }
  return {
    text,
    usageProvided: Boolean(result.usage),
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
      neurons: result.usage?.neurons,
    },
  };
}
