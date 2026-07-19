import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import corsPlugin from "../../src/plugins/cors.js";

describe("plugin de CORS", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(corsPlugin);
    app.get("/rota-qualquer", async () => ({ ok: true }));
    await app.ready();
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

  it("inclui Access-Control-Allow-Origin numa requisição normal com header Origin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rota-qualquer",
      headers: { origin: "http://localhost:5173" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
