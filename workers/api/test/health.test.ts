import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { HealthResponse } from "@learwizai/types";

describe("GET /api/health", () => {
  it("returns 200 with service identity and a passing db check", async () => {
    const response = await SELF.fetch("http://local/api/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("learwizai-api");
    expect(body.checks.db).toBe("ok");
    expect(typeof body.environment).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns JSON 404 for unknown /api routes", async () => {
    const response = await SELF.fetch("http://local/api/does-not-exist");
    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });
});
