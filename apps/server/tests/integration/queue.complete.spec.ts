import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("POST /queue/items/:id/complete", () => {
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

  it("conclui o item em andamento do operador: status muda, duração é calculada", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });

    const response = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("completed");

    const [log] = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(log?.outcome).toBe("completed");
    expect(log?.completedAt).toBeInstanceOf(Date);
    expect(log?.durationSeconds).toBeGreaterThanOrEqual(0);
    await app.close();
  });

  it("retorna 404 para item inexistente", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op2");

    const response = await app.inject({
      method: "POST",
      url: "/queue/items/00000000-0000-4000-8000-000000000000/complete",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 403 ao tentar concluir item de outro operador", async () => {
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
      url: `/queue/items/${item.id}/complete`,
      headers: { authorization: `Bearer ${token4}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("retorna 403 ao tentar concluir item que ainda está pending (nunca foi pego)", async () => {
    await createUser(ctx.db, { username: "op5", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op5");

    const response = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("retorna 409 ao tentar concluir item já concluído (idempotência / duplo clique)", async () => {
    await createUser(ctx.db, { username: "op6", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op6");

    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${token}` } });
    await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    const secondResponse = await app.inject({
      method: "POST",
      url: `/queue/items/${item.id}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(secondResponse.statusCode).toBe(409);
    await app.close();
  });
});
