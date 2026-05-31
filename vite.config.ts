import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  worker: {
    format: "es",
  },
  test: {
    // Exclude Playwright E2E specs — those run under `pnpm test:e2e`, not vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});
