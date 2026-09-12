import { describe, expect, it } from "vitest";
import { hashPassword, passwordIterations, verifyPassword } from "../src/services/passwords";

describe("passwords (PBKDF2, §40.10)", () => {
  it("round-trips hash → verify and never stores plaintext", async () => {
    const stored = await hashPassword("correct horse battery", 10_000);
    expect(stored).toMatch(/^pbkdf2\$sha256\$10000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(stored).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects wrong passwords and malformed stored values", async () => {
    const stored = await hashPassword("correct horse battery", 10_000);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
    expect(await verifyPassword("correct horse battery", "garbage")).toBe(false);
    expect(await verifyPassword("correct horse battery", "pbkdf2$sha256$x$yy$zz")).toBe(false);
  });

  it("salts every hash uniquely", async () => {
    const a = await hashPassword("same-password", 10_000);
    const b = await hashPassword("same-password", 10_000);
    expect(a).not.toBe(b);
  });

  it("reads the iteration override with safe bounds", () => {
    expect(passwordIterations({ PASSWORD_HASH_ITERATIONS: "250000" })).toBe(250_000);
    expect(passwordIterations({ PASSWORD_HASH_ITERATIONS: "100" })).toBe(100_000); // below floor
    expect(passwordIterations({})).toBe(100_000);
  });
});
