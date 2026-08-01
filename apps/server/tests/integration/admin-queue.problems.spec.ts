import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createQueueItem, createUser, createWorkLog } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("GET /admin/queue/problems", () => {
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

  async function loginAs(app: Awaited<ReturnType<typeof buildTestApp>>, username: string) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "senha-de-teste-123" },
    });
    return response.json().accessToken as string;
  }

  it("retorna itens com status problem, incluindo a nota do operador e quem reportou — antes só dava pra ver via filtro na fila, sem a nota", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-problema", role: "operator", displayName: "Operador Problema" });
    const product = await createProduct(ctx.db, { name: "Bolo Fake com Problema" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id, status: "problem" });
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T10:05:00.000Z"),
      outcome: "problem",
      problemNote: "Faltou o topo do bolo na caixa",
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      id: item.id,
      productName: "Bolo Fake com Problema",
      problemNote: "Faltou o topo do bolo na caixa",
      operatorId: operator.id,
      operatorDisplayName: "Operador Problema",
    });
    await app.close();
  });

  it("item sem produto vinculado retorna productName: null, mantendo o payload cru pro fallback de nome", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-sem-produto", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, {
      batchId: batch.id,
      productId: null,
      status: "problem",
      payload: { nome: "Item Cru" },
    });
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: new Date(),
      completedAt: new Date(),
      outcome: "problem",
      problemNote: "Sem produto vinculado ainda",
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems",
      headers: { authorization: `Bearer ${token}` },
    });

    const returned = response.json().items[0];
    expect(returned.productName).toBeNull();
    expect(returned.payload).toEqual({ nome: "Item Cru" });
    await app.close();
  });

  it("não retorna itens pending/in_progress/completed/cancelled", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, status: "pending" });
    await createQueueItem(ctx.db, { batchId: batch.id, status: "in_progress" });
    await createQueueItem(ctx.db, { batchId: batch.id, status: "completed" });
    await createQueueItem(ctx.db, { batchId: batch.id, status: "cancelled" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json()).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    await app.close();
  });

  it("um item requeued (voltou a status problem duas vezes) mostra só a nota mais recente", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const operatorOld = await createUser(ctx.db, { username: "op-antigo", role: "operator", displayName: "Operador Antigo" });
    const operatorNew = await createUser(ctx.db, { username: "op-novo", role: "operator", displayName: "Operador Novo" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operatorOld.id,
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T10:05:00.000Z"),
      outcome: "problem",
      problemNote: "Nota antiga",
    });
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operatorNew.id,
      startedAt: new Date("2026-01-02T10:00:00.000Z"),
      completedAt: new Date("2026-01-02T10:05:00.000Z"),
      outcome: "problem",
      problemNote: "Nota mais recente",
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems",
      headers: { authorization: `Bearer ${token}` },
    });

    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items[0].problemNote).toBe("Nota mais recente");
    expect(body.items[0].operatorDisplayName).toBe("Operador Novo");
    await app.close();
  });

  it("respeita paginação, ordenado do mais recente pro mais antigo", async () => {
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-paginacao", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const older = await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    const newer = await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    await createWorkLog(ctx.db, {
      queueItemId: older.id,
      operatorId: operator.id,
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T10:00:00.000Z"),
      outcome: "problem",
      problemNote: "Mais antigo",
    });
    await createWorkLog(ctx.db, {
      queueItemId: newer.id,
      operatorId: operator.id,
      startedAt: new Date("2026-01-02T10:00:00.000Z"),
      completedAt: new Date("2026-01-02T10:00:00.000Z"),
      outcome: "problem",
      problemNote: "Mais recente",
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin5");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems?page=1&pageSize=1",
      headers: { authorization: `Bearer ${token}` },
    });

    const body = response.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(newer.id);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/problems",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("retorna 401 sem token", async () => {
    const app = await buildTestApp(ctx.db);
    const response = await app.inject({ method: "GET", url: "/admin/queue/problems" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
