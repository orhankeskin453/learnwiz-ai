import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    // The root `pnpm test` runs every package at once; under that CPU load the
    // 5s default turns passing assertions into timeouts. Give real headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
