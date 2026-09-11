import { describe, expect, it } from "vitest";
import { resolveLocale } from "@/i18n/resolveLocale";

describe("resolveLocale (§6.3 precedence)", () => {
  it("prefers an explicit cookie choice", () => {
    expect(
      resolveLocale({ cookieValue: "tr", storedValue: "en", browserLanguages: ["en-US"] }),
    ).toBe("tr");
  });

  it("falls back to stored choice when no cookie", () => {
    expect(resolveLocale({ storedValue: "tr", browserLanguages: ["en-US"] })).toBe("tr");
  });

  it("falls back to browser language with region subtags", () => {
    expect(resolveLocale({ browserLanguages: ["de-DE", "tr-TR", "en-US"] })).toBe("tr");
    expect(resolveLocale({ browserLanguages: ["en-GB"] })).toBe("en");
  });

  it("ignores invalid cookie/storage values", () => {
    expect(resolveLocale({ cookieValue: "de", storedValue: "fr", browserLanguages: [] })).toBe(
      "en",
    );
  });

  it("defaults to en with no signals", () => {
    expect(resolveLocale({})).toBe("en");
  });
});
