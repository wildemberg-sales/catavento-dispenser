import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createQueueItem, createUser, createWorkLog } from "../setup/factories.js";
import { queueRepository } from "../../src/modules/queue/queue.repository.js";
import { queueService } from "../../src/modules/queue/queue.service.js";

describe("abandonStale (Seção 5.2)", () => {
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

  it("devolve à fila (pending) um item cujo work_log excedeu o timeout", async () => {
    const operator = await createUser(ctx.db, { role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "in_progress" });
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await createWorkLog(ctx.db, { queueItemId: item.id, operatorId: operator.id, startedAt: thirtyMinutesAgo });

    const service = queueService({ repo: queueRepository(ctx.db) });
    const affected = await service.abandonStale(15);

    expect(affected).toBe(1);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("pending");

    const [log] = await ctx.db.select().from(schema.workLogs).where(eq(schema.workLogs.queueItemId, item.id));
    expect(log?.outcome).toBe("abandoned");
    expect(log?.completedAt).toBeInstanceOf(Date);
  });

  it("não afeta work_logs dentro do timeout", async () => {
    const operator = await createUser(ctx.db, { role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "in_progress" });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await createWorkLog(ctx.db, { queueItemId: item.id, operatorId: operator.id, startedAt: fiveMinutesAgo });

    const service = queueService({ repo: queueRepository(ctx.db) });
    const affected = await service.abandonStale(15);

    expect(affected).toBe(0);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("in_progress");
  });

  it("não reprocessa work_logs já concluídos normalmente", async () => {
    const operator = await createUser(ctx.db, { role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "completed" });
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: thirtyMinutesAgo,
      completedAt: new Date(Date.now() - 20 * 60 * 1000),
      outcome: "completed",
    });

    const service = queueService({ repo: queueRepository(ctx.db) });
    const affected = await service.abandonStale(15);

    expect(affected).toBe(0);

    const [updatedItem] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.id, item.id));
    expect(updatedItem?.status).toBe("completed");
  });

  it("após o abandono, o item volta a estar disponível para outro operador via dequeue", async () => {
    const operator1 = await createUser(ctx.db, { role: "operator" });
    const operator2 = await createUser(ctx.db, { role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, status: "in_progress" });
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await createWorkLog(ctx.db, { queueItemId: item.id, operatorId: operator1.id, startedAt: thirtyMinutesAgo });

    const service = queueService({ repo: queueRepository(ctx.db) });
    await service.abandonStale(15);

    const result = await service.dequeueNext(operator2.id);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.item.id).toBe(item.id);
    }
  });
});
