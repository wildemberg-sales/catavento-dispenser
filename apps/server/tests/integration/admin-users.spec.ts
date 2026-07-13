import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("Gestão de usuários (admin)", () => {
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

  async function loginAs(app: Awaited<ReturnType<typeof buildTestApp>>, username: string, password = "senha-de-teste-123") {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password },
    });
    return response.json();
  }

  it("cria operador; senha nunca aparece na resposta; usuário criado consegue logar", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { username: "novo-operador", password: "senha12345", role: "operator", displayName: "Novo Operador" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).not.toHaveProperty("passwordHash");

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "novo-operador", password: "senha12345" },
    });
    expect(loginResponse.statusCode).toBe(200);
    await app.close();
  });

  it("retorna 409 para username duplicado", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await createUser(ctx.db, { username: "existente", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { username: "existente", password: "senha12345", role: "operator", displayName: "Duplicado" },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { username: "x", password: "senha12345", role: "operator", displayName: "X" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("lista usuários paginados com filtros de role e isActive", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    await createUser(ctx.db, { username: "op2", role: "operator" });
    await createUser(ctx.db, { username: "op3", role: "operator", isActive: false });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin3");

    const byRole = await app.inject({
      method: "GET",
      url: "/admin/users?role=operator",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(byRole.json().total).toBe(2);

    const byActive = await app.inject({
      method: "GET",
      url: "/admin/users?isActive=false",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(byActive.json().total).toBe(1);
    await app.close();
  });

  it("desativa usuário e revoga os refresh tokens ativos dele", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op4", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { accessToken: adminToken } = await loginAs(app, "admin4");
    const { refreshToken } = await loginAs(app, "op4");

    const response = await app.inject({
      method: "PUT",
      url: `/admin/users/${operator.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().isActive).toBe(false);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(401);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op4", password: "senha-de-teste-123" },
    });
    expect(loginResponse.statusCode).toBe(403);
    await app.close();
  });

  it("admin não pode desativar a própria conta", async () => {
    const admin = await createUser(ctx.db, { username: "admin5", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin5");

    const response = await app.inject({
      method: "PUT",
      url: `/admin/users/${admin.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("PUT com body vazio retorna 400", async () => {
    const admin = await createUser(ctx.db, { username: "admin6", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin6");

    const response = await app.inject({
      method: "PUT",
      url: `/admin/users/${admin.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("reset de senha: login antigo falha, login com nova senha funciona", async () => {
    await createUser(ctx.db, { username: "admin7", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op7", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin7");

    const response = await app.inject({
      method: "POST",
      url: `/admin/users/${operator.id}/reset-password`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { newPassword: "novaSenha123" },
    });
    expect(response.statusCode).toBe(204);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op7", password: "senha-de-teste-123" },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op7", password: "novaSenha123" },
    });
    expect(newLogin.statusCode).toBe(200);
    await app.close();
  });

  it("PUT em usuário inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin9", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin9");

    const response = await app.inject({
      method: "PUT",
      url: "/admin/users/00000000-0000-4000-8000-000000000000",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { displayName: "Não existe" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("reset de senha de usuário inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin10", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin10");

    const response = await app.inject({
      method: "POST",
      url: "/admin/users/00000000-0000-4000-8000-000000000000/reset-password",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { newPassword: "12345678" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("reset de senha com senha curta retorna 400", async () => {
    await createUser(ctx.db, { username: "admin8", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op8", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const { accessToken } = await loginAs(app, "admin8");

    const response = await app.inject({
      method: "POST",
      url: `/admin/users/${operator.id}/reset-password`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { newPassword: "123" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
