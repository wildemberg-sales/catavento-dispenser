import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { monitorBus } from "../../src/lib/monitor-bus.js";

describe("POST /auth/login", () => {
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

  it("retorna tokens e usuário para credenciais válidas", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin1", password: "senha-de-teste-123" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body.user.username).toBe("admin1");
    expect(body.user.role).toBe("admin");
    await app.close();
  });

  it("retorna 401 para senha incorreta", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin2", password: "senha-errada" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("INVALID_CREDENTIALS");
    await app.close();
  });

  it("retorna 401 para usuário inexistente (mesma mensagem genérica)", async () => {
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "nao-existe", password: "qualquer-coisa" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("INVALID_CREDENTIALS");
    await app.close();
  });

  it("retorna 403 para usuário desativado", async () => {
    await createUser(ctx.db, { username: "desativado", role: "operator", isActive: false });
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "desativado", password: "senha-de-teste-123" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("ACCOUNT_DISABLED");
    await app.close();
  });

  it("retorna 400 quando o body não é válido (username vazio)", async () => {
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "", password: "abc" },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("publica operator_online quando um operador loga", async () => {
    const user = await createUser(ctx.db, { username: "op-online", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-online", password: "senha-de-teste-123" },
    });

    expect(publishSpy).toHaveBeenCalledWith({ type: "operator_online", payload: { operatorId: user.id } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("NÃO publica operator_online quando um admin loga", async () => {
    await createUser(ctx.db, { username: "admin-login", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin-login", password: "senha-de-teste-123" },
    });

    expect(publishSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "operator_online" }));
    publishSpy.mockRestore();
    await app.close();
  });
});

describe("POST /auth/refresh", () => {
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

  async function login(app: Awaited<ReturnType<typeof buildTestApp>>, username: string) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "senha-de-teste-123" },
    });
    return response.json() as { accessToken: string; refreshToken: string };
  }

  it("retorna novo par de tokens para um refresh token válido", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { refreshToken } = await login(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    await app.close();
  });

  it("rotaciona o refresh token: o token antigo deixa de funcionar após o uso", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { refreshToken } = await login(app, "op2");

    await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    const second = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

    expect(second.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 401 para refresh token inválido/malformado", async () => {
    const app = await buildTestApp(ctx.db);

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "token-invalido" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 401 para refresh token revogado (após logout)", async () => {
    await createUser(ctx.db, { username: "op3", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { refreshToken } = await login(app, "op3");

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });
    const response = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 401 quando o usuário foi desativado após o token ter sido emitido", async () => {
    const user = await createUser(ctx.db, { username: "op5", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { refreshToken } = await login(app, "op5");

    await ctx.db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, user.id));
    const response = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("POST /auth/logout", () => {
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

  it("revoga o refresh token: retorna 204 e o token deixa de funcionar", async () => {
    await createUser(ctx.db, { username: "op4", role: "operator" });
    const app = await buildTestApp(ctx.db);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op4", password: "senha-de-teste-123" },
    });
    const { refreshToken } = loginResponse.json();

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(401);
    await app.close();
  });

  it("publica operator_offline quando um operador desloga", async () => {
    const user = await createUser(ctx.db, { username: "op-offline", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-offline", password: "senha-de-teste-123" },
    });
    const { refreshToken } = loginResponse.json();
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });

    expect(publishSpy).toHaveBeenCalledWith({ type: "operator_offline", payload: { operatorId: user.id } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("não publica nada e continua retornando 204 ao deslogar com um refresh token já inválido", async () => {
    const app = await buildTestApp(ctx.db);
    const publishSpy = vi.spyOn(monitorBus, "publish");

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: "token-que-nao-existe" },
    });

    expect(response.statusCode).toBe(204);
    expect(publishSpy).not.toHaveBeenCalled();
    publishSpy.mockRestore();
    await app.close();
  });
});
