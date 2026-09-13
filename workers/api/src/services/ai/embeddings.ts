/**
 * Embeddings (CLAUDE.md §13.5) + Vectorize queries (§12.1) behind seams with
 * deterministic test mocks — same pattern as the chat mock (Step 5 spec D10).
 */
import type { Env } from "../../env";

export function embeddingModel(env: Env): string {
  return env.AI_EMBEDDING_MODEL ?? "@cf/qwen/qwen3-embedding-0.6b";
}

interface EmbedMockSpec {
  behavior: "embed" | "fail";
  /** One base vector; cloned per input text so similarity is deterministic. */
  vector?: number[];
}

function embedMocks(env: Env): Record<string, EmbedMockSpec> | null {
  if (!env.AI_MOCK_RESPONSES) return null;
  return JSON.parse(env.AI_MOCK_RESPONSES) as Record<string, EmbedMockSpec>;
}

/** Embed a batch of texts → one vector per input (same order). */
export async function runEmbeddings(env: Env, texts: string[]): Promise<number[][]> {
  const specs = embedMocks(env);
  if (specs) {
    const spec = specs[embeddingModel(env)];
    if (!spec || spec.behavior === "fail" || !spec.vector) {
      throw new Error("mock embedding failure");
    }
    return texts.map((_, i) => spec.vector!.map((v, j) => v + i * 0.01 * j));
  }
  const result = (await env.AI.run(embeddingModel(env), { text: texts })) as unknown as {
    data?: number[][];
  };
  if (!result.data || result.data.length !== texts.length) {
    throw new Error(
      `embedding model returned ${result.data?.length ?? 0} vectors for ${texts.length} texts`,
    );
  }
  return result.data;
}

export interface VectorMatch {
  id: string;
  score: number;
}

/** Vectorize query with a canned-match seam for tests (spec D7). */
export async function queryVectors(
  env: Env,
  vector: number[],
  topK: number,
): Promise<VectorMatch[]> {
  if (env.VEC_MOCK_MATCHES) {
    return JSON.parse(env.VEC_MOCK_MATCHES) as VectorMatch[];
  }
  const result = await env.VECTORIZE.query(vector, { topK, returnValues: false });
  return result.matches.map((m) => ({ id: m.id, score: m.score }));
}

export async function upsertVectors(
  env: Env,
  vectors: Array<{ id: string; values: number[]; metadata?: Record<string, string | number> }>,
): Promise<void> {
  if (env.AI_MOCK_RESPONSES) return; // tests: vectorize writes are not asserted
  await env.VECTORIZE.upsert(vectors);
}

export async function deleteVectors(env: Env, ids: string[]): Promise<void> {
  if (env.AI_MOCK_RESPONSES || ids.length === 0) return;
  await env.VECTORIZE.deleteByIds(ids);
}
