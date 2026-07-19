import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
    },
  },
  test: {
    environment: "jsdom",
    environmentMatchGlobs: [
      ["src/main/**", "node"],
      ["src/preload/**", "node"],
    ],
    globals: false,
    setupFiles: ["./src/renderer/vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
      include: ["src/renderer/src/**/*.{ts,tsx}", "src/main/**/*.ts", "src/preload/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/*.d.ts",
        "src/renderer/src/main.tsx",
        "src/main/index.ts",
        "src/preload/index.ts",
      ],
    },
  },
});
