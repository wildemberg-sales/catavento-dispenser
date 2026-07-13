import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("GET /queue/current", () => {
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

  it("retorna o item em andamento do operador autenticado", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });

    const response = await app.inject({
      method: "GET",
      url: "/queue/current",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: true, item: expect.objectContaining({ id: item.id }) });
    await app.close();
  });

  it("retorna { available: false } quando o operador não tem item em andamento", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op2");

    const response = await app.inject({
      method: "GET",
      url: "/queue/current",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: false });
    await app.close();
  });

  it("não retorna o item em andamento de outro operador", async () => {
    await createUser(ctx.db, { username: "op3", role: "operator" });
    await createUser(ctx.db, { username: "op4", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token3 = await loginAs(app, "op3");
    const token4 = await loginAs(app, "op4");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token3}` } });

    const response = await app.inject({
      method: "GET",
      url: "/queue/current",
      headers: { authorization: `Bearer ${token4}` },
    });

    expect(response.json()).toEqual({ available: false });
    await app.close();
  });

  it("reidrata o item com os dados herdados do produto vinculado", async () => {
    await createUser(ctx.db, { username: "op5", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto Reidratado" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op5");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });

    const response = await app.inject({
      method: "GET",
      url: "/queue/current",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.json().item.product.name).toBe("Produto Reidratado");
    await app.close();
  });
});
