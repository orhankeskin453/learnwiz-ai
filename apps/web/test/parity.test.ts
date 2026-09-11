import { describe, expect, it } from "vitest";
import { NAMESPACES, resources } from "@/i18n/resources";

function collectKeys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

function collectLeafValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node !== "object" || node === null) return [];
  return Object.values(node as Record<string, unknown>).flatMap(collectLeafValues);
}

describe("en/tr translation parity (CLAUDE.md §6.1)", () => {
  it.each([...NAMESPACES])("namespace %s has identical key trees in en and tr", (ns) => {
    const enKeys = collectKeys(resources.en[ns]).sort();
    const trKeys = collectKeys(resources.tr[ns]).sort();
    const missingInTr = enKeys.filter((k) => !trKeys.includes(k));
    const extraInTr = trKeys.filter((k) => !enKeys.includes(k));
    expect({ missingInTr, extraInTr }).toEqual({ missingInTr: [], extraInTr: [] });
  });

  it("has no empty string values in any locale", () => {
    for (const locale of ["en", "tr"] as const) {
      for (const ns of NAMESPACES) {
        const leaves = collectLeafValues(resources[locale][ns]);
        expect(leaves.every((v) => v.trim().length > 0)).toBe(true);
      }
    }
  });
});
