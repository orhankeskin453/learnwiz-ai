import { beforeEach, describe, expect, it } from "vitest";
import i18n, { getActiveLocale } from "@/i18n";
import { formatDate, formatNumber, formatRelativeTime } from "@/i18n/format";

describe("Intl format utils (§6.1)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("formats numbers per locale (decimal separators differ)", async () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    await i18n.changeLanguage("tr");
    // Turkish locale uses comma decimal / period thousands separators
    expect(formatNumber(1234.5)).toMatch(/1[.,]234/);
  });

  it("formats dates in both locales without throwing and produces different output", async () => {
    const date = new Date(2026, 0, 15);
    const en = formatDate(date);
    await i18n.changeLanguage("tr");
    const tr = formatDate(date);
    expect(en.length).toBeGreaterThan(0);
    expect(tr).toMatch(/2026|Oca/);
    expect(en).not.toBe(tr);
  });

  it("formats relative time with numeric auto", async () => {
    expect(formatRelativeTime(-1, "day")).toMatch(/yesterday/i);
    await i18n.changeLanguage("tr");
    expect(formatRelativeTime(-1, "day")).toMatch(/dün/i);
  });

  it("getActiveLocale tracks the i18n language", async () => {
    expect(getActiveLocale()).toBe("en");
    await i18n.changeLanguage("tr");
    expect(getActiveLocale()).toBe("tr");
  });
});
