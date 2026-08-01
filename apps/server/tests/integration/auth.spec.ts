import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createQueueItem, createUser } from "../setup/factories.js";
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

  it("reuso de um refresh token já rotacionado derruba toda a família de sessões — o token novo emitido no primeiro refresh também para de funcionar", async () => {
    await createUser(ctx.db, { username: "op-reuso", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { refreshToken: original } = await login(app, "op-reuso");

    const firstRefresh = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: original } });
    const { refreshToken: rotated } = firstRefresh.json();

    // reusa o token original (já revogado pela rotação acima) — sinal de roubo
    const reuseAttempt = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: original } });
    expect(reuseAttempt.statusCode).toBe(401);

    // o token novo (emitido no primeiro refresh, ainda dentro da validade)
    // também deveria ter sido revogado — não só o token reusado
    const rotatedAfterReuse = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: rotated } });
    expect(rotatedAfterReuse.statusCode).toBe(401);
    await app.close();
  });

  it("reuso de um refresh token revogado via logout derruba as outras sessões ativas do mesmo usuário", async () => {
    await createUser(ctx.db, { username: "op-multi-sessao", role: "operator" });
    const app = await buildTestApp(ctx.db);
    // duas "sessões" (dois refresh tokens ativos) pro mesmo usuário — login
    // não revoga sessões anteriores, então logar duas vezes simula dois
    // dispositivos logados ao mesmo tempo.
    const sessionA = await login(app, "op-multi-sessao");
    const sessionB = await login(app, "op-multi-sessao");

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken: sessionA.refreshToken } });

    // reusa o token já revogado pelo logout
    const reuseAttempt = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: sessionA.refreshToken },
    });
    expect(reuseAttempt.statusCode).toBe(401);

    // a outra sessão, que ainda era válida, também deveria ter sido derrubada
    const otherSessionRefresh = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: sessionB.refreshToken },
    });
    expect(otherSessionRefresh.statusCode).toBe(401);
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

  it("publica operator_offline mesmo quando o refresh token já foi revogado antes (ex.: logout chamado duas vezes)", async () => {
    const user = await createUser(ctx.db, { username: "op-double-logout", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-double-logout", password: "senha-de-teste-123" },
    });
    const { refreshToken } = loginResponse.json();

    // Primeiro logout — revoga o token de verdade no banco.
    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });

    // Segundo logout com o MESMO token — antes da correção, `stored` vinha
    // null (token já revogado) e nada era publicado, deixando o operador
    // "online" pra sempre caso esse fosse o único evento de offline recebido.
    const publishSpy = vi.spyOn(monitorBus, "publish");
    const secondResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken },
    });

    expect(secondResponse.statusCode).toBe(204);
    expect(publishSpy).toHaveBeenCalledWith({ type: "operator_offline", payload: { operatorId: user.id } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("logout libera o item em andamento do operador de volta pra fila, sem esperar o timeout de abandono", async () => {
    const operator = await createUser(ctx.db, { username: "op-libera-item", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "pending" });
    const app = await buildTestApp(ctx.db);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-libera-item", password: "senha-de-teste-123" },
    });
    const { accessToken, refreshToken } = loginResponse.json();
    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${accessToken}` } });

    const [inProgress] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(inProgress?.status).toBe("in_progress");

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });

    const [afterLogout] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(afterLogout?.status).toBe("pending");

    const [log] = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(log?.outcome).toBe("abandoned");
    expect(log?.completedAt).toBeInstanceOf(Date);
    void operator;
    await app.close();
  });

  it("logout sem item em andamento não publica queue_size_changed", async () => {
    await createUser(ctx.db, { username: "op-sem-item", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-sem-item", password: "senha-de-teste-123" },
    });
    const { refreshToken } = loginResponse.json();
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });

    expect(publishSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "queue_size_changed" }));
    publishSpy.mockRestore();
    await app.close();
  });
});
