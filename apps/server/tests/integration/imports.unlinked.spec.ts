import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("GET /admin/imports/:id/unlinked — reconciliação manual e fuzzy matching", () => {
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

  it("retorna só os itens não vinculados do lote", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    await createQueueItem(ctx.db, { batchId: batch.id, productId: null });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${batch.id}/unlinked`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().total).toBe(1);
    await app.close();
  });

  it("sugere produtos com nome parecido ao payload do item, ordenado por score", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await createProduct(ctx.db, { name: "Cabo USB-C 1 Metro" });
    await createProduct(ctx.db, { name: "Teclado Mecânico" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, {
      batchId: batch.id,
      productId: null,
      payload: { nome: "Cabo USBC 1m" },
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${batch.id}/unlinked`,
      headers: { authorization: `Bearer ${token}` },
    });

    const item = response.json().items[0];
    expect(item.suggestions.length).toBeGreaterThan(0);
    expect(item.suggestions[0].productName).toBe("Cabo USB-C 1 Metro");
    await app.close();
  });

  it("não sugere produtos com nome completamente diferente", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    await createProduct(ctx.db, { name: "Panela de Pressão" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, productId: null, payload: { nome: "Fone Bluetooth XPTO" } });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${batch.id}/unlinked`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().items[0].suggestions).toHaveLength(0);
    await app.close();
  });

  it("usa external_ref para o fuzzy quando o payload não tem chave nome/name", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    await createProduct(ctx.db, { name: "REFXPTO123" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, {
      batchId: batch.id,
      productId: null,
      externalRef: "REFXPTO123",
      payload: {},
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${batch.id}/unlinked`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().items[0].suggestions[0].productName).toBe("REFXPTO123");
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${batch.id}/unlinked`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
