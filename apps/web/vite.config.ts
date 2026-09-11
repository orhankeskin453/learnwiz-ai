import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local dev: wrangler dev serves the API on :8787 (see root `pnpm dev`).
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
  },
});
