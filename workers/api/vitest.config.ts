import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Deterministic AI fixtures (spec D10): the mock model picks its output by a
// marker in the system prompt, so every feature suite gets a schema-valid JSON
// payload without spending real neurons.
const LESSON_JSON = JSON.stringify({
  title: "Photosynthesis",
  blocks: [
    { kind: "concept", content: "Plants convert light into chemical energy." },
    { kind: "intuition", content: "Think of leaves as tiny solar kitchens." },
    { kind: "example", content: "A leaf in sunlight produces glucose from CO2 and water." },
    { kind: "common_mistakes", content: "Believing plants eat soil for mass." },
    { kind: "mini_exercise", content: "List the inputs and outputs of photosynthesis." },
    {
      kind: "check_understanding",
      content: "Check yourself.",
      question: "What gas do plants release?",
      answer: "Oxygen.",
    },
  ],
});

const PRACTICE_JSON = JSON.stringify({
  questions: [
    {
      question: "What is the main input of photosynthesis?",
      options: ["Oxygen", "Light", "Sugar", "Nitrogen"],
      answer: 1,
      explanation: "Light drives the reaction.",
    },
    {
      question: "Where does photosynthesis happen?",
      options: ["Roots", "Mitochondria", "Chloroplasts", "Nucleus"],
      answer: 2,
      explanation: "Chloroplasts contain chlorophyll.",
    },
    {
      question: "What gas is released?",
      options: ["CO2", "Oxygen", "Methane", "Hydrogen"],
      answer: 1,
      explanation: "Oxygen is a by-product.",
    },
  ],
});

const QUIZ_JSON = JSON.stringify({
  questions: [
    {
      question: "Q1 gravity",
      options: ["a", "b", "c", "d"],
      answer: 0,
      explanation: "because",
    },
    { question: "Q2 gravity", options: ["a", "b", "c", "d"], answer: 1, explanation: "because" },
    { question: "Q3 gravity", options: ["a", "b", "c", "d"], answer: 2, explanation: "because" },
    { question: "Q4 gravity", options: ["a", "b", "c", "d"], answer: 3, explanation: "because" },
    { question: "Q5 gravity", options: ["a", "b", "c", "d"], answer: 0, explanation: "because" },
  ],
});

export default defineWorkersConfig(async () => {
  // Read migration files at config time and inject them as a test binding so
  // test/apply-migrations.ts can apply them to the LOCAL miniflare D1.
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "../../db/migrations"));

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              // Top-level wrangler.jsonc sets ENVIRONMENT=production; tests run
              // as a local env so cookie Secure-flag behavior matches local dev.
              ENVIRONMENT: "test",
              // Local-only test secret (≥32 chars); production uses `wrangler secret put`.
              GUEST_SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
              // Keep PBKDF2 fast in tests (min 10k enforced by passwordIterations).
              PASSWORD_HASH_ITERATIONS: "10000",
              // Deterministic AI (spec D10): keyed by model name; the fallback
              // model matches structured-generation fixtures by system-prompt
              // marker. The primary always fails → the §18 fallback path is
              // exercised on every request.
              AI_MOCK_RESPONSES: JSON.stringify({
                "mock-primary": { behavior: "fail" },
                "mock-fallback": {
                  behavior: "stream",
                  defaultText: "Merhaba! Öğrenmeye başlayalım.",
                  usage: { prompt_tokens: 21, completion_tokens: 9 },
                  match: [
                    { ifSystemContains: "lesson architect", text: LESSON_JSON },
                    { ifSystemContains: "practice coach", text: PRACTICE_JSON },
                    { ifSystemContains: "quiz generator", text: QUIZ_JSON },
                  ],
                },
                "mock-embedding": {
                  behavior: "embed",
                  vector: [0.1, 0.2, 0.3],
                },
                "mock-ok": {
                  behavior: "stream",
                  text: "Hello! Let's learn.",
                  usage: { prompt_tokens: 20, completion_tokens: 8 },
                },
              }),
              AI_EMBEDDING_MODEL: "mock-embedding",
              // Vectorize test seam (spec D7): answerDocumentQuestion serves the
              // first chunks in document order instead of querying Vectorize.
              VEC_MOCK_MATCHES: "test-seam",
              AI_FALLBACK_MODEL: "mock-fallback",
              // Bootstrap admin allowlist (§40.6) — promoted at register/login.
              ADMIN_EMAILS: "boot-admin@example.com",
            },
          },
        },
      },
    },
  };
});
