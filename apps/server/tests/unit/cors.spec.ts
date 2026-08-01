import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import corsPlugin from "../../src/plugins/cors.js";
import { buildTestConfig } from "../setup/build-test-app.js";

async function buildCorsTestApp(corsAllowedOrigins: string): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  await app.register(corsPlugin, { config: buildTestConfig({ CORS_ALLOWED_ORIGINS: corsAllowedOrigins }) });
  app.get("/rota-qualquer", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("plugin de CORS", () => {
  describe("sem CORS_ALLOWED_ORIGINS configurada (modo permissivo, default)", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      app = await buildCorsTestApp("");
    });

    afterEach(async () => {
      await app.close();
    });

    it("responde ao preflight OPTIONS sem exigir autenticação", async () => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/rota-qualquer",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET",
        },
      });

      expect([200, 204]).toContain(response.statusCode);
      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });

    it("inclui Access-Control-Allow-Origin numa requisição normal com header Origin, refletindo qualquer origem", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/rota-qualquer",
        headers: { origin: "http://localhost:5173" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
  });

  describe("com CORS_ALLOWED_ORIGINS configurada (allowlist restrita)", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      app = await buildCorsTestApp("https://admin.exemplo.com,https://outra.exemplo.com");
    });

    afterEach(async () => {
      await app.close();
    });

    it("reflete a origem quando ela está na allowlist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/rota-qualquer",
        headers: { origin: "https://admin.exemplo.com" },
      });

      expect(response.headers["access-control-allow-origin"]).toBe("https://admin.exemplo.com");
    });

    it("não reflete a origem quando ela não está na allowlist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/rota-qualquer",
        headers: { origin: "https://origem-nao-autorizada.com" },
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
