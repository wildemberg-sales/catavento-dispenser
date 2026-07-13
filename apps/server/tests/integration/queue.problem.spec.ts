import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("POST /queue/items/:id/problem", () => {
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

  it("marca o item como problem com a nota informada", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });

    const response = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/problem`,
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "Peça avariada na chegada" },
    });

    expect(response.statusCode).toBe(200);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("problem");

    const [log] = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(log?.outcome).toBe("problem");
    expect(log?.problemNote).toBe("Peça avariada na chegada");
    expect(log?.completedAt).toBeInstanceOf(Date);
    await app.close();
  });

  it("retorna 400 quando a nota está vazia", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op2");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });

    const response = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/problem`,
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "" },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("retorna 403 ao reportar problema em item de outro operador", async () => {
    await createUser(ctx.db, { username: "op3", role: "operator" });
    await createUser(ctx.db, { username: "op4", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token3 = await loginAs(app, "op3");
    const token4 = await loginAs(app, "op4");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token3}` } });

    const response = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/problem`,
      headers: { authorization: `Bearer ${token4}` },
      payload: { note: "Tentando reportar item alheio" },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
