/**
 * Structured AI generation (CLAUDE.md §10.6): the model must return STRICT JSON;
 * markdown fences are stripped, the payload is validated with zod BEFORE it can
 * reach a client, and a failure triggers exactly ONE §18 fallback-model attempt.
 * The caller records the §14 ledger row (it knows plan/locale context).
 */
import type { Env } from "../../env";
import {
  runChat,
  fallbackModel,
  primaryModel,
  type ChatCompletion,
  type ChatMessage,
} from "./client";

export class AiUnavailableError extends Error {
  constructor() {
    super("ai unavailable");
    this.name = "AiUnavailableError";
  }
}

/**
 * Strip markdown fences and reasoning traces, then extract the first balanced
 * JSON object (reasoning models sometimes emit brace-containing thinking text
 * around the payload, which breaks a naive first-"{" / last-"}" slice).
 */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, "");
  const start = cleaned.indexOf("{");
  if (start === -1) {
    throw new Error("no JSON object in model output");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (error) {
          throw new Error(
            `invalid JSON in model output: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
  throw new Error("unterminated JSON object in model output");
}

export interface Generated<T> {
  data: T;
  model: string;
  fallback: boolean;
  usage: ChatCompletion["usage"];
}

export async function generateStructured<T>(
  env: Env,
  opts: { messages: ChatMessage[]; schema: { parse: (value: unknown) => T } },
): Promise<Generated<T>> {
  const attempt = async (model: string): Promise<Generated<T>> => {
    // Structured generation: cap output so long JSON is never truncated, and keep
    // temperature low for schema adherence.
    const completion = await runChat(env, model, opts.messages, {
      maxTokens: 4096,
      temperature: 0.3,
    });
    const data = opts.schema.parse(extractJson(completion.text));
    return { data, model, fallback: model !== primaryModel(env), usage: completion.usage };
  };

  const primary = primaryModel(env);
  try {
    return await attempt(primary);
  } catch (primaryError) {
    console.error("ai_generation_failed", {
      model: primary,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });
    const fallback = fallbackModel(env);
    try {
      return await attempt(fallback);
    } catch (fallbackError) {
      console.error("ai_fallback_failed", {
        model: fallback,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
      throw new AiUnavailableError();
    }
  }
}
