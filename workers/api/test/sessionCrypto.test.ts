import { describe, expect, it } from "vitest";
import {
  generateGuestSessionId,
  pepperedHash,
  signGuestCookie,
  verifyGuestCookie,
} from "../src/services/sessionCrypto";

const SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";

describe("sessionCrypto", () => {
  it("generates 64-char opaque hex ids that never repeat", () => {
    const a = generateGuestSessionId();
    const b = generateGuestSessionId();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it("round-trips sign → verify", async () => {
    const id = generateGuestSessionId();
    const cookie = await signGuestCookie(id, SECRET);
    expect(cookie).toBe(`${id}.${cookie.split(".")[1]}`);
    expect(await verifyGuestCookie(cookie, SECRET)).toBe(id);
  });

  it("rejects tampered signatures", async () => {
    const id = generateGuestSessionId();
    const cookie = await signGuestCookie(id, SECRET);
    const validId = cookie.split(".")[0]!;
    const validSig = cookie.split(".")[1]!;
    const tampered = `${validId}.${validSig.slice(0, -2)}ff`;
    expect(await verifyGuestCookie(tampered, SECRET)).toBeNull();
  });

  it("rejects signatures from a different secret", async () => {
    const id = generateGuestSessionId();
    const cookie = await signGuestCookie(id, SECRET);
    expect(await verifyGuestCookie(cookie, `${SECRET}-other`)).toBeNull();
  });

  it("rejects malformed cookie values", async () => {
    expect(await verifyGuestCookie("", SECRET)).toBeNull();
    expect(await verifyGuestCookie("no-signature", SECRET)).toBeNull();
    expect(await verifyGuestCookie(".orphan-signature", SECRET)).toBeNull();
  });

  it("pepperedHash is deterministic, value-hiding and secret-sensitive", async () => {
    const h1 = await pepperedHash("1.2.3.4", SECRET);
    const h2 = await pepperedHash("1.2.3.4", SECRET);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toContain("1.2.3.4");
    expect(await pepperedHash("1.2.3.4", `${SECRET}-x`)).not.toBe(h1);
  });
});
