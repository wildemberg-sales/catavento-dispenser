import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import jwtPlugin from "../../src/plugins/jwt.js";
import sensiblePlugin from "../../src/plugins/sensible.js";
import errorHandlerPlugin from "../../src/plugins/error-handler.js";
import { requireAuth, requireRole } from "../../src/modules/auth/rbac.js";
import { buildTestConfig } from "../setup/build-test-app.js";

describe("RBAC (requireAuth/requireRole) via HTTP", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.register(jwtPlugin, { config: buildTestConfig() });
    await app.register(errorHandlerPlugin);

    app.get("/admin-only", { preHandler: [requireAuth(app), requireRole("admin")] }, async () => ({
      ok: true,
    }));
    app.get("/any-authenticated", { preHandler: [requireAuth(app)] }, async (req) => ({
      role: req.authUser?.role,
    }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("retorna 401 quando não há header Authorization", async () => {
    const response = await app.inject({ method: "GET", url: "/any-authenticated" });
    expect(response.statusCode).toBe(401);
  });

  it("retorna 403 quando o papel autenticado não tem permissão", async () => {
    const token = app.jwt.sign({ sub: "u1", role: "operator", username: "op" });
    const response = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("retorna 200 quando o papel autenticado tem permissão", async () => {
    const token = app.jwt.sign({ sub: "u1", role: "admin", username: "adm" });
    const response = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
  });
});
