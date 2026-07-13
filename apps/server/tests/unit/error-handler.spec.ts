import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import sensiblePlugin from "../../src/plugins/sensible.js";
import errorHandlerPlugin from "../../src/plugins/error-handler.js";
import { InvalidCredentialsError } from "../../src/lib/errors.js";

describe("error handler", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.register(errorHandlerPlugin);

    app.get("/boom", async () => {
      throw new Error("algo quebrou internamente");
    });
    app.get("/domain-error", async () => {
      throw new InvalidCredentialsError();
    });
    app.get("/forbidden", async (_req, reply) => {
      throw reply.forbidden("sem permissão");
    });
    app.get("/not-found", async (_req, reply) => {
      throw reply.notFound("item não encontrado");
    });
    app.get("/too-many-requests", async (_req, reply) => {
      throw reply.tooManyRequests("calma lá");
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("mapeia erro inesperado (5xx) para 500 com mensagem genérica, sem vazar detalhes internos", async () => {
    const response = await app.inject({ method: "GET", url: "/boom" });
    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error).toBe("INTERNAL_ERROR");
    expect(body.message).not.toContain("algo quebrou internamente");
  });

  it("mapeia DomainError para seu statusCode e code próprios", async () => {
    const response = await app.inject({ method: "GET", url: "/domain-error" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("INVALID_CREDENTIALS");
  });

  it("mapeia erro 403 do @fastify/sensible para FORBIDDEN", async () => {
    const response = await app.inject({ method: "GET", url: "/forbidden" });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("FORBIDDEN");
  });

  it("mapeia erro 404 explícito (reply.notFound) para NOT_FOUND", async () => {
    const response = await app.inject({ method: "GET", url: "/not-found" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("NOT_FOUND");
  });

  it("usa HTTP_ERROR como fallback para status codes não mapeados", async () => {
    const response = await app.inject({ method: "GET", url: "/too-many-requests" });
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toBe("HTTP_ERROR");
  });
});
