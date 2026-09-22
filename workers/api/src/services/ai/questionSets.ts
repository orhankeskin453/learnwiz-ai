/**
 * Question-set generation with parallel chunking (Step 11 perf work).
 *
 * A 10-question set is generated as two independent 5-question calls run
 * concurrently, which roughly halves wall-clock latency for large sets. Results
 * are merged and de-duplicated; the caller records ONE §14 ledger row with the
 * summed token usage so plan accounting stays "one generation = one message".
 */
import type { Locale, PracticeQuestion, QuizDifficulty } from "@learwizai/types";
import { questionSetSchema } from "@learwizai/validation";
import type { Env } from "../../env";
import type { ChatCompletion } from "./client";
import { AiUnavailableError, generateStructured } from "./generate";
import { buildPracticeMessages, buildQuizMessages } from "./prompts";

/** Questions per model call — larger sets are split into parallel chunks. */
export const CHUNK_SIZE = 5;

export interface GeneratedSet {
  questions: PracticeQuestion[];
  model: string;
  fallback: boolean;
  usage: ChatCompletion["usage"];
  /** Number of model calls that succeeded (1 for small sets, ≥2 when chunked). */
  calls: number;
}

/** Split a requested count into chunks of at most CHUNK_SIZE. */
export function splitCount(count: number): number[] {
  if (count <= CHUNK_SIZE) return [count];
  const chunks: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(CHUNK_SIZE, remaining);
    chunks.push(size);
    remaining -= size;
  }
  return chunks;
}

export async function generateQuestionSet(
  env: Env,
  input: { topic: string; count: number; locale: Locale; difficulty?: QuizDifficulty },
): Promise<GeneratedSet> {
  const chunks = splitCount(input.count);

  const settled = await Promise.allSettled(
    chunks.map((size) =>
      generateStructured(env, {
        messages: input.difficulty
          ? buildQuizMessages(input.topic, input.difficulty, size, input.locale)
          : buildPracticeMessages(input.topic, size, input.locale),
        schema: questionSetSchema,
      }),
    ),
  );

  const succeeded = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    // A failed chunk degrades the set instead of failing the whole request —
    // only when EVERY chunk fails do we surface ai_unavailable (§18).
    console.error("question_chunk_failed", {
      chunk: index,
      size: chunks[index],
      error: String(result.reason).slice(0, 200),
    });
    return [];
  });
  if (succeeded.length === 0) throw new AiUnavailableError();

  const questions: PracticeQuestion[] = [];
  const seen = new Set<string>();
  for (const result of succeeded) {
    for (const question of result.data.questions) {
      const key = question.question.trim().toLowerCase();
      if (seen.has(key)) continue; // cross-chunk duplicate guard
      seen.add(key);
      questions.push(question);
    }
  }
  if (questions.length === 0) throw new AiUnavailableError();

  const usage = succeeded.reduce(
    (acc, result) => ({
      promptTokens: acc.promptTokens + result.usage.promptTokens,
      completionTokens: acc.completionTokens + result.usage.completionTokens,
      neurons:
        acc.neurons === undefined
          ? result.usage.neurons
          : acc.neurons + (result.usage.neurons ?? 0),
    }),
    { promptTokens: 0, completionTokens: 0, neurons: undefined as number | undefined },
  );

  return {
    questions,
    model: succeeded[0]!.model,
    fallback: succeeded.some((result) => result.fallback),
    usage,
    calls: succeeded.length,
  };
}
