import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("GET /admin/queue/unlinked — reconciliação global (cross-lote)", () => {
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

  it("retorna itens sem vínculo de qualquer lote, não só de um específico", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const product = await createProduct(ctx.db);
    const batch1 = await createImportBatch(ctx.db);
    const batch2 = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch1.id, productId: product.id });
    const unlinkedInBatch1 = await createQueueItem(ctx.db, { batchId: batch1.id, productId: null });
    const unlinkedInBatch2 = await createQueueItem(ctx.db, { batchId: batch2.id, productId: null });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/unlinked",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(2);
    const ids = body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([unlinkedInBatch1.id, unlinkedInBatch2.id]));
    await app.close();
  });

  it("cada item inclui batchId, createdAt e sugestões fuzzy", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await createProduct(ctx.db, { name: "Bolo Fake Rosa 2 Andares" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, {
      batchId: batch.id,
      productId: null,
      payload: { nome: "Bolo Fake Rosa 2 Andar" },
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/unlinked",
      headers: { authorization: `Bearer ${token}` },
    });

    const item = response.json().items[0];
    expect(item.batchId).toBe(batch.id);
    expect(typeof item.createdAt).toBe("string");
    expect(item.suggestions[0].productName).toBe("Bolo Fake Rosa 2 Andares");
    await app.close();
  });

  it("respeita paginação", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    for (let i = 0; i < 3; i++) {
      await createQueueItem(ctx.db, { batchId: batch.id, productId: null });
    }
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/unlinked?page=1&pageSize=2",
      headers: { authorization: `Bearer ${token}` },
    });

    const body = response.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "GET",
      url: "/admin/queue/unlinked",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
