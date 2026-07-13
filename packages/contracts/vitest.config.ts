import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
      exclude: ["**/tests/**", "**/*.d.ts"],
    },
  },
});
