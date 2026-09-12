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

/** Strip markdown fences and extract the outermost JSON object. */
export function extractJson(raw: string): unknown {
  const withoutFences = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("no JSON object in model output");
  }
  return JSON.parse(withoutFences.slice(start, end + 1));
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
    const completion = await runChat(env, model, opts.messages);
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
