import { describe, expect, it } from "vitest";
import { featureLock, featureSchema } from "../src/index";

describe("featureSchema", () => {
  it("accepts the §5.1 guest capabilities", () => {
    expect(featureSchema.parse("ai_tutor")).toBe("ai_tutor");
    expect(featureSchema.parse("learn_mode")).toBe("learn_mode");
    expect(featureSchema.parse("practice")).toBe("practice");
    expect(featureSchema.parse("quiz")).toBe("quiz");
  });

  it("rejects unknown capabilities", () => {
    expect(featureSchema.safeParse("documents").success).toBe(false);
    expect(featureSchema.safeParse("").success).toBe(false);
    expect(featureSchema.safeParse(42).success).toBe(false);
  });

  it("stays contract-locked to the shared Feature type", () => {
    expect(featureLock).toBe(true);
  });
});
