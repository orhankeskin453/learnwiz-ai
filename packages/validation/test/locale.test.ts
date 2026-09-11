import { describe, expect, it } from "vitest";
import { localeSchema } from "../src/index";

describe("localeSchema", () => {
  it("accepts supported locales", () => {
    expect(localeSchema.parse("en")).toBe("en");
    expect(localeSchema.parse("tr")).toBe("tr");
  });

  it("rejects unsupported locales", () => {
    expect(localeSchema.safeParse("de").success).toBe(false);
    expect(localeSchema.safeParse("").success).toBe(false);
    expect(localeSchema.safeParse(42).success).toBe(false);
  });
});
