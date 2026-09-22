import { describe, expect, it } from "vitest";
import { lessonContentSchema, questionSetSchema } from "../src/index";

const VALID_LESSON = {
  title: "Photosynthesis",
  blocks: [
    { kind: "concept", content: "Concept text" },
    { kind: "intuition", content: "Intuition text" },
    { kind: "example", content: "Example text" },
    { kind: "common_mistakes", content: "Mistakes text" },
    { kind: "mini_exercise", content: "Exercise text" },
    {
      kind: "check_understanding",
      content: "Check text",
      question: "What gas is released?",
      answer: "Oxygen.",
    },
  ],
};

describe("lessonContentSchema normalization (spec D1 safe repairs)", () => {
  it("accepts a well-formed lesson unchanged", () => {
    const parsed = lessonContentSchema.parse(VALID_LESSON);
    expect(parsed.blocks).toHaveLength(6);
    expect(parsed.blocks[5]!.kind).toBe("check_understanding");
  });

  it("survives the failure seen in production: check_understanding without question/answer", () => {
    const degraded = {
      ...VALID_LESSON,
      blocks: VALID_LESSON.blocks.map((b) =>
        b.kind === "check_understanding"
          ? { kind: "check_understanding", content: "Soru: Hangi gaz salınır? Cevap: Oksijen." }
          : b,
      ),
    };
    const parsed = lessonContentSchema.parse(degraded);
    const check = parsed.blocks[5] as { question: string; answer: string };
    // Question degrades to the block content; the empty answer hides the reveal in the UI.
    expect(check.question).toContain("Hangi gaz");
    expect(check.answer).toBe("");
  });

  it("joins array content, reorders blocks, drops unknown kinds and clamps long text", () => {
    const messy = {
      title: "T",
      blocks: [
        { kind: "check_understanding", content: ["Check", "more"], question: "Q", answer: "A" },
        { kind: "not_a_block", content: "Ignore me" },
        { kind: "example", content: "E" },
        { kind: "concept", content: "x".repeat(5000) },
        { kind: "intuition", content: "I" },
        { kind: "mini_exercise", content: "M" },
        { kind: "common_mistakes", content: "C" },
      ],
    };
    const parsed = lessonContentSchema.parse(messy);
    expect(parsed.blocks.map((b) => b.kind)).toEqual([
      "concept",
      "intuition",
      "example",
      "common_mistakes",
      "mini_exercise",
      "check_understanding",
    ]);
    expect(parsed.blocks[0]!.content.length).toBeLessThanOrEqual(4000);
    expect(parsed.blocks[0]!.content.endsWith("…")).toBe(true);
    expect((parsed.blocks[5] as { content: string }).content).toContain("Check");
  });

  it("still rejects structurally incomplete lessons (missing block kind)", () => {
    const missingExample = {
      ...VALID_LESSON,
      blocks: VALID_LESSON.blocks.filter((b) => b.kind !== "example"),
    };
    expect(lessonContentSchema.safeParse(missingExample).success).toBe(false);
  });
});

describe("questionSetSchema normalization", () => {
  const question = {
    question: "Q?",
    options: ["a", "b", "c", "d"],
    answer: 1,
    explanation: "because",
  };

  it("coerces a string answer index and trims options", () => {
    const parsed = questionSetSchema.parse({
      questions: [{ ...question, answer: "2", options: [" a", "b ", "c", "d"] }],
    });
    expect(parsed.questions[0]!.answer).toBe(2);
    expect(parsed.questions[0]!.options[0]).toBe("a");
  });

  it("drops malformed questions (duplicate options, bad index) instead of failing the set", () => {
    const parsed = questionSetSchema.parse({
      questions: [
        question,
        { ...question, options: ["a", "a", "c", "d"] },
        { ...question, answer: 7 },
      ],
    });
    expect(parsed.questions).toHaveLength(1);
  });

  it("fails when no usable question survives", () => {
    expect(questionSetSchema.safeParse({ questions: [{ ...question, answer: "B" }] }).success).toBe(
      false,
    );
  });
});
