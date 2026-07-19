import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { monitorBus } from "../../src/lib/monitor-bus.js";

describe("GET /admin/queue e ações administrativas", () => {
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

  it("lista itens paginados, filtra por status e por batchId", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const batch1 = await createImportBatch(ctx.db);
    const batch2 = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch1.id, status: "pending" });
    await createQueueItem(ctx.db, { batchId: batch1.id, status: "completed" });
    await createQueueItem(ctx.db, { batchId: batch2.id, status: "pending" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const all = await app.inject({ method: "GET", url: "/admin/queue", headers: { authorization: `Bearer ${token}` } });
    expect(all.json().total).toBe(3);

    const byStatus = await app.inject({
      method: "GET",
      url: "/admin/queue?status=pending",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(byStatus.json().total).toBe(2);

    const byBatch = await app.inject({
      method: "GET",
      url: `/admin/queue?batchId=${batch2.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(byBatch.json().total).toBe(1);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");
    const response = await app.inject({ method: "GET", url: "/admin/queue", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("requeue: item problem volta a pending", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/requeue`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);

    const [updated] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updated?.status).toBe("pending");
    await app.close();
  });

  it("requeue publica queue_size_changed com o tamanho atual da fila", async () => {
    await createUser(ctx.db, { username: "admin-requeue-evento", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "problem" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-requeue-evento");
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/requeue`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(publishSpy).toHaveBeenCalledWith({ type: "queue_size_changed", payload: { queueSize: 1 } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("cancel publica queue_size_changed com o tamanho atual da fila", async () => {
    await createUser(ctx.db, { username: "admin-cancel-evento", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "pending" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-cancel-evento");
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(publishSpy).toHaveBeenCalledWith({ type: "queue_size_changed", payload: { queueSize: 0 } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("requeue de item completed retorna 409", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "completed" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/requeue`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("requeue de item inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "POST",
      url: "/admin/queue/items/00000000-0000-4000-8000-000000000000/requeue",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("cancel: item in_progress vira cancelled e o work_log ativo é fechado com outcome cancelled", async () => {
    const operator = await createUser(ctx.db, { username: "op2", role: "operator" });
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    const app = await buildTestApp(ctx.db);
    const opToken = await loginAs(app, "op2");
    await app.inject({ method: "POST", url: "/queue/next", headers: { authorization: `Bearer ${opToken}` } });

    const adminToken = await loginAs(app, "admin5");
    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("cancelled");

    const [log] = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(log?.outcome).toBe("cancelled");
    expect(log?.completedAt).toBeInstanceOf(Date);

    // O operador consegue pegar um novo item normalmente depois do cancelamento.
    const batch2 = await createImportBatch(ctx.db);
    await createQueueItem(ctx.db, { batchId: batch2.id });
    const nextResponse = await app.inject({
      method: "POST",
      url: "/queue/next",
      headers: { authorization: `Bearer ${opToken}` },
    });
    expect(nextResponse.json().available).toBe(true);
    void operator;
    await app.close();
  });

  it("cancel de item inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin7", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin7");

    const response = await app.inject({
      method: "POST",
      url: "/admin/queue/items/00000000-0000-4000-8000-000000000000/cancel",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("cancel de item completed retorna 409", async () => {
    await createUser(ctx.db, { username: "admin6", role: "admin" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "completed" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin6");

    const response = await app.inject({
      method: "POST",
      url: `/admin/queue/items/${item.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });
});
