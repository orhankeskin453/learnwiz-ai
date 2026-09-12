import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { clientIp, isUsableSecret, requireSecret } from "../src/middleware/identity";
import { ConfigError } from "../src/services/identity";

const VALID_SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";

/** Only GUEST_SESSION_SECRET matters to requireSecret; stub the rest of Env. */
function envWith(secret: string | undefined): Env {
  return { GUEST_SESSION_SECRET: secret } as Env;
}

describe("requireSecret (fail-closed, spec D4)", () => {
  it("accepts a long, non-placeholder secret", () => {
    expect(requireSecret(envWith(VALID_SECRET))).toBe(VALID_SECRET);
  });

  it("throws ConfigError when the secret is missing or too short", () => {
    expect(() => requireSecret(envWith(undefined))).toThrow(ConfigError);
    expect(() => requireSecret(envWith("short"))).toThrow(ConfigError);
  });

  it("rejects the .dev.vars.example placeholder verbatim", () => {
    expect(() => requireSecret(envWith("replace-with-64-hex-chars-per-env"))).toThrow(ConfigError);
    expect(isUsableSecret("replace-with-64-hex-chars-per-env")).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses CF-Connecting-IP and never trusts client-controlled XFF", () => {
    const cf = {
      req: { header: (n: string) => (n === "CF-Connecting-IP" ? "1.2.3.4" : undefined) },
    };
    expect(clientIp(cf as never)).toBe("1.2.3.4");

    const spoof = {
      req: { header: (n: string) => (n === "X-Forwarded-For" ? "9.9.9.9" : undefined) },
    };
    expect(clientIp(spoof as never)).toBe("unknown");
  });
});
