import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("rate limiting em /auth/login e /auth/refresh", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await startTestDb();
  }, 60000);

  afterAll(async () => {
    await stopTestDb(ctx);
  });

  beforeEach(async () => {
    await truncateAll(ctx.db);
  });

  it("bloqueia com 429 após exceder o máximo de tentativas de login na janela configurada", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db, { AUTH_RATE_LIMIT_MAX: 3, AUTH_RATE_LIMIT_WINDOW_MS: 60000 });

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { username: "admin1", password: "senha-errada" },
      });

    const responses = [await attempt(), await attempt(), await attempt(), await attempt()];

    expect(responses.slice(0, 3).every((r) => r.statusCode !== 429)).toBe(true);
    expect(responses[3]!.statusCode).toBe(429);
    await app.close();
  });

  it("bloqueia com 429 após exceder o máximo de tentativas de refresh na janela configurada", async () => {
    const app = await buildTestApp(ctx.db, { AUTH_RATE_LIMIT_MAX: 3, AUTH_RATE_LIMIT_WINDOW_MS: 60000 });

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "token-invalido" },
      });

    const responses = [await attempt(), await attempt(), await attempt(), await attempt()];

    expect(responses.slice(0, 3).every((r) => r.statusCode !== 429)).toBe(true);
    expect(responses[3]!.statusCode).toBe(429);
    await app.close();
  });

  it("login e refresh têm contadores de rate limit independentes um do outro", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db, { AUTH_RATE_LIMIT_MAX: 2, AUTH_RATE_LIMIT_WINDOW_MS: 60000 });

    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { username: "admin2", password: "senha-errada" },
      });
    }
    const thirdLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin2", password: "senha-errada" },
    });
    expect(thirdLogin.statusCode).toBe(429);

    // /refresh não deveria estar bloqueado só porque /login esgotou o limite
    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "token-invalido" },
    });
    expect(refreshResponse.statusCode).not.toBe(429);
    await app.close();
  });

  it("/auth/logout não é afetado pelo rate limit de login/refresh", async () => {
    const app = await buildTestApp(ctx.db, { AUTH_RATE_LIMIT_MAX: 1, AUTH_RATE_LIMIT_WINDOW_MS: 60000 });

    // esgota o limite de login
    await app.inject({ method: "POST", url: "/auth/login", payload: { username: "x", password: "y" } });
    const secondLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "x", password: "y" },
    });
    expect(secondLogin.statusCode).toBe(429);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: "qualquer-coisa" },
    });
    expect(logoutResponse.statusCode).not.toBe(429);
    await app.close();
  });
});
