import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createProductImage, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("POST /queue/next", () => {
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

  it("retorna o item pendente e marca in_progress, criando um work_log", async () => {
    const operator = await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.available).toBe(true);
    expect(body.item.id).toBe(item.id);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("in_progress");

    const logs = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.operatorId).toBe(operator.id);
    expect(logs[0]?.completedAt).toBeNull();
    expect(logs[0]?.startedAt).toBeInstanceOf(Date);
    await app.close();
  });

  it("retorna { available: false } quando a fila está vazia, sem criar work_log", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op2");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: false });

    const logs = await ctx.db.select().from(schema.workLogs);
    expect(logs).toHaveLength(0);
    await app.close();
  });

  it("retorna o item de maior prioridade primeiro, independente da ordem de chegada", async () => {
    await createUser(ctx.db, { username: "op3", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, priority: 0 });
    const highPriority = await createQueueItem(ctx.db, { batchId: batch.id, priority: 10 });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op3");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.id).toBe(highPriority.id);
    await app.close();
  });

  it("com mesma prioridade, retorna o item mais antigo (FIFO) primeiro", async () => {
    await createUser(ctx.db, { username: "op4", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const first = await createQueueItem(ctx.db, { batchId: batch.id, priority: 5 });
    await createQueueItem(ctx.db, { batchId: batch.id, priority: 5 });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op4");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.id).toBe(first.id);
    await app.close();
  });

  it("retorna um item vinculado a um produto antes de um item sem vínculo, mesmo com prioridade menor", async () => {
    await createUser(ctx.db, { username: "op-deprioriza", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto Vinculado Baixa Prioridade" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, priority: 10, productId: null });
    const linkedLowPriority = await createQueueItem(ctx.db, { batchId: batch.id, priority: 0, productId: product.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-deprioriza");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.id).toBe(linkedLowPriority.id);
    await app.close();
  });

  it("entre itens sem vínculo, prioridade por loja e FIFO continuam valendo", async () => {
    await createUser(ctx.db, { username: "op-sem-vinculo-ordem", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, priority: 0, productId: null });
    const highPriorityUnlinked = await createQueueItem(ctx.db, { batchId: batch.id, priority: 10, productId: null });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-sem-vinculo-ordem");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.id).toBe(highPriorityUnlinked.id);
    await app.close();
  });

  it("nunca retorna itens que não estão pending (completed, cancelled, problem)", async () => {
    await createUser(ctx.db, { username: "op5", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, status: "completed" });
    await createQueueItem(ctx.db, { batchId: batch.id, status: "cancelled" });
    await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op5");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json()).toEqual({ available: false });
    await app.close();
  });

  it("exige autenticação (401 sem token)", async () => {
    const app = await buildTestApp(ctx.db);
    const response = await app.inject({ method: "POST", url: "/queue/next" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("exige papel de operador (403 para admin)", async () => {
    await createUser(ctx.db, { username: "admin-x", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-x");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("item vinculado a um produto retorna os dados herdados (nome, descrição, atributos, imagens)", async () => {
    await createUser(ctx.db, { username: "op-herda", role: "operator" });
    const product = await createProduct(ctx.db, {
      name: "Produto Vinculado",
      description: "Descrição do produto",
      attributes: { cor: "azul" },
    });
    await createProductImage(ctx.db, { productId: product.id, url: "memory://a.png", position: 1 });
    await createProductImage(ctx.db, { productId: product.id, url: "memory://b.png", position: 0 });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-herda");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    const item = response.json().item;
    expect(item.product).not.toBeNull();
    expect(item.product.name).toBe("Produto Vinculado");
    expect(item.product.description).toBe("Descrição do produto");
    expect(item.product.attributes).toEqual({ cor: "azul" });
    expect(item.product.images.map((i: { position: number }) => i.position)).toEqual([0, 1]);
    await app.close();
  });

  it("item sem vínculo retorna product: null, mantendo o payload cru", async () => {
    await createUser(ctx.db, { username: "op-sem-vinculo", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, payload: { nome: "Cru" } });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-sem-vinculo");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    const item = response.json().item;
    expect(item.product).toBeNull();
    expect(item.payload).toEqual({ nome: "Cru" });
    await app.close();
  });

  it("produto vinculado mas soft-deletado depois ainda é retornado ao operador", async () => {
    await createUser(ctx.db, { username: "op-desativado", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto que será desativado" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    await ctx.db.update(schema.products).set({ isActive: false }).where(eq(schema.products.id, product.id));
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-desativado");

    const response = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.product).not.toBeNull();
    expect(response.json().item.product.name).toBe("Produto que será desativado");
    await app.close();
  });
});
