import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/tests/**", "**/*.d.ts", "src/seed/**", "src/migrate.ts"],
    },
  },
});
