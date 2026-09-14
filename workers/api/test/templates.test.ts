import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/email/templates";

const PARAMS = { url: "https://example.test/auth/verify?token=abc" };

describe("email templates (§47.11)", () => {
  it("renders all auth templates in English and Turkish", () => {
    for (const key of ["verification", "welcome", "password_reset"]) {
      for (const locale of ["en", "tr"] as const) {
        const content = renderTemplate(key, locale, PARAMS);
        expect(content.subject.length).toBeGreaterThan(0);
        expect(content.html).toContain(PARAMS.url);
        expect(content.text).toContain(PARAMS.url);
        expect(content.html).not.toContain("<script");
      }
    }
  });

  it("localizes the subject per locale", () => {
    const en = renderTemplate("verification", "en", PARAMS);
    const tr = renderTemplate("verification", "tr", PARAMS);
    expect(en.subject).not.toBe(tr.subject);
    expect(tr.subject).toContain("LearnWiz AI");
  });

  it("falls back to English for unknown locales", () => {
    const fallback = renderTemplate("verification", "de" as never, PARAMS);
    expect(fallback.subject).toBe(renderTemplate("verification", "en", PARAMS).subject);
  });

  it("throws on unknown template keys (programmer error)", () => {
    expect(() => renderTemplate("marketing", "en", PARAMS)).toThrow(/Unknown email template/);
  });
});
