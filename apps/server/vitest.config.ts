import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
      exclude: ["**/tests/**", "**/*.d.ts", "src/server.ts"],
    },
    testTimeout: 30000,
    hookTimeout: 60000,
    // Cada arquivo de teste de integração sobe seu próprio container
    // Postgres via Testcontainers. Sem um teto, todos os arquivos rodam em
    // paralelo e podem sobrecarregar o Docker local (observado: erro
    // transitório 57P01 sob ~14 containers simultâneos).
    pool: "forks",
    maxWorkers: 4,
  },
});
