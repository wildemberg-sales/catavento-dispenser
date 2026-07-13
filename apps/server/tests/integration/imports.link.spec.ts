import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createProductSku, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("POST /admin/imports/:id/link — vinculação automática por SKU", () => {
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

  it("vincula queue_items ao product_id correto, casando por (source, sku)", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const product = await createProduct(ctx.db, { name: "Produto Vinculável" });
    await createProductSku(ctx.db, { productId: product.id, source: "mercado_livre", sku: "ABC123" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, source: "mercado_livre", externalRef: "ABC123" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "POST",
      url: `/admin/imports/${batch.id}/link`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ linkedCount: 1, totalItems: 1 });

    const [updated] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updated?.productId).toBe(product.id);
    await app.close();
  });

  it("não vincula quando o SKU bate mas a fonte é diferente", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const product = await createProduct(ctx.db);
    await createProductSku(ctx.db, { productId: product.id, source: "mercado_livre", sku: "ABC123" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, source: "shopee", externalRef: "ABC123" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    await app.inject({ method: "POST", url: `/admin/imports/${batch.id}/link`, headers: { authorization: `Bearer ${token}` } });

    const [updated] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updated?.productId).toBeNull();
    await app.close();
  });

  it("é idempotente: rodar duas vezes não altera nada na segunda chamada", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const product = await createProduct(ctx.db);
    await createProductSku(ctx.db, { productId: product.id, source: "ebay", sku: "XYZ" });
    const batch = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch.id, source: "ebay", externalRef: "XYZ" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const first = await app.inject({ method: "POST", url: `/admin/imports/${batch.id}/link`, headers: { authorization: `Bearer ${token}` } });
    expect(first.json().linkedCount).toBe(1);

    const second = await app.inject({ method: "POST", url: `/admin/imports/${batch.id}/link`, headers: { authorization: `Bearer ${token}` } });
    expect(second.json().linkedCount).toBe(0);
    await app.close();
  });

  it("não sobrescreve um vínculo manual já existente", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const productA = await createProductWithSku(ctx.db, "mercado_livre", "REF-1");
    const productB = await createProduct(ctx.db, { name: "Produto B (vínculo manual)" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, {
      batchId: batch.id,
      source: "mercado_livre",
      externalRef: "REF-1",
      productId: productB.id,
    });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    await app.inject({ method: "POST", url: `/admin/imports/${batch.id}/link`, headers: { authorization: `Bearer ${token}` } });

    const [updated] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updated?.productId).toBe(productB.id);
    void productA;
    await app.close();
  });

  async function createProductWithSku(db: TestDbContext["db"], source: "mercado_livre" | "shopee" | "ebay", sku: string) {
    const product = await createProduct(db);
    await createProductSku(db, { productId: product.id, source, sku });
    return product;
  }

  it("retorna 404 para batchId inexistente", async () => {
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin5");

    const response = await app.inject({
      method: "POST",
      url: "/admin/imports/00000000-0000-4000-8000-000000000000/link",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: `/admin/imports/${batch.id}/link`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
