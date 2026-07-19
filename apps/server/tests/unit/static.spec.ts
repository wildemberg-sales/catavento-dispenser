import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import configPlugin from "../../src/plugins/config.js";
import staticPlugin from "../../src/plugins/static.js";
import type { Config } from "../../src/config/env.js";

function buildConfig(overrides: Partial<Config> = {}): Config {
  return {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    PGPOOL_MAX: 10,
    JWT_ACCESS_SECRET: "access-secret",
    JWT_REFRESH_SECRET: "refresh-secret",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "7d",
    ABANDONMENT_CHECK_INTERVAL_MS: 60000,
    ABANDONMENT_TIMEOUT_MINUTES: 15,
    PORT: 3000,
    LOG_LEVEL: "info",
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: "./.data/uploads",
    STORAGE_PUBLIC_BASE_URL: "http://localhost:3000/uploads",
    MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
    MAX_IMAGES_PER_PRODUCT: 8,
    ANALYTICS_MAX_RANGE_DAYS: 90,
    ...overrides,
  };
}

describe("plugin de arquivos estáticos", () => {
  let app: FastifyInstance;
  let uploadsDir: string;

  beforeEach(() => {
    uploadsDir = mkdtempSync(join(tmpdir(), "catavento-uploads-"));
  });

  afterEach(async () => {
    await app.close();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it("serve um arquivo gravado no diretório configurado quando STORAGE_DRIVER=local", async () => {
    writeFileSync(join(uploadsDir, "produto.png"), "conteudo-fake-de-imagem");

    app = fastify({ logger: false });
    await app.register(configPlugin, { config: buildConfig({ STORAGE_LOCAL_DIR: uploadsDir }) });
    await app.register(staticPlugin);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/uploads/produto.png" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("conteudo-fake-de-imagem");
  });

  it("responde 404 para um arquivo inexistente", async () => {
    app = fastify({ logger: false });
    await app.register(configPlugin, { config: buildConfig({ STORAGE_LOCAL_DIR: uploadsDir }) });
    await app.register(staticPlugin);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/uploads/nao-existe.png" });

    expect(response.statusCode).toBe(404);
  });

  it("não registra a rota /uploads quando STORAGE_DRIVER=memory", async () => {
    app = fastify({ logger: false });
    await app.register(configPlugin, { config: buildConfig({ STORAGE_DRIVER: "memory" }) });
    await app.register(staticPlugin);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/uploads/produto.png" });

    expect(response.statusCode).toBe(404);
  });
});
