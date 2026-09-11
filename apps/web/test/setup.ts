import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import * as AxeNS from "axe-core";

// In vitest (ESM), import * as ns wraps CJS — real API is at .default.
const _axe = (AxeNS as unknown as { default: { run(this: void): unknown } }).default ?? AxeNS;
/* eslint-disable @typescript-eslint/no-explicit-any -- axe-core ESM interop */
const axe: any = _axe;
/* eslint-enable @typescript-eslint/no-explicit-any */

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): Promise<void>;
  }
}

// Document-level accessibility rules that only apply to full-page audits.
// jsdom has no <title>, no <html lang> — these always fire on bare containers.
// They are never relevant when auditing individual React components in isolation.
const SKIP_RULES = ["document-title", "html-has-lang"];

expect.extend({
  async toHaveNoViolations(_received: unknown) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: axe-core return shape varies
      const results: { violations: Array<{ id: string }> } = await axe.run(_received);
      const violations = (results.violations ?? []).filter((v) => !SKIP_RULES.includes(v.id));
      if (violations.length === 0) {
        return {
          pass: true,
          message: () => `Expected axe results to have violations but none were found.`,
        };
      }
      return {
        pass: false,
        message: () =>
          `Expected axe results to have no violations but found ${violations.length}: ${JSON.stringify(violations, null, 2)}`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        pass: false,
        message: () => `axe.run threw during assertion — ${detail}`,
      };
    }
  },
});

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia; ThemeProvider and tests rely on it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
