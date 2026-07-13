import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("POST /admin/queue/items/:id/link — vínculo manual", () => {
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

  it("vincula o item ao produto informado", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/link`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id },
    });
    expect(response.statusCode).toBe(200);

    const [updated] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updated?.productId).toBe(product.id);
    await app.close();
  });

  it("retorna 404 para produto inexistente", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/link`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 404 para produto inativo", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const product = await createProduct(ctx.db, { isActive: false });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/link`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 404 para queue_item inexistente", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "POST",
      url: "/admin/queue/items/00000000-0000-4000-8000-000000000000/link",
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/link`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
