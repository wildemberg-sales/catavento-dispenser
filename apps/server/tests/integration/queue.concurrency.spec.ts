import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createManyQueueItems, createQueueItem, createUser } from "../setup/factories.js";
import { queueRepository } from "../../src/modules/queue/queue.repository.js";
import { queueService } from "../../src/modules/queue/queue.service.js";

describe("dequeue concurrency (teste-carro-chefe)", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    // Pool com `max` alto o bastante para que N chamadas concorrentes cheguem
    // de fato ao Postgres ao mesmo tempo — é o SKIP LOCKED do banco que deve
    // garantir exclusividade, não o pool de conexões do lado do cliente.
    ctx = await startTestDb({ max: 60 });
  }, 60000);

  afterAll(async () => {
    await stopTestDb(ctx);
  });

  beforeEach(async () => {
    await truncateAll(ctx.db);
  });

  it("atribui cada queue_item a exatamente um operador sob N pedidos simultâneos", async () => {
    const N_ITEMS = 30;
    const N_OPERATORS = 50; // teto real de operadores (Seção 11.1)

    const batch = await createImportBatch(ctx.db);
    await createManyQueueItems(ctx.db, { batchId: batch.id, count: N_ITEMS });
    const operators = await Promise.all(
      Array.from({ length: N_OPERATORS }, () => createUser(ctx.db, { role: "operator" }))
    );

    const service = queueService({ repo: queueRepository(ctx.db) });

    const results = await Promise.allSettled(operators.map((op) => service.dequeueNext(op.id)));

    const assignedIds = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof service.dequeueNext>>>).value)
      .filter((v) => v.available)
      .map((v) => v.item.id);

    // 1. nenhum item foi atribuído a mais de um operador
    expect(new Set(assignedIds).size).toBe(assignedIds.length);

    // 2. o número de itens atribuídos é exatamente min(N_ITEMS, N_OPERATORS)
    expect(assignedIds.length).toBe(Math.min(N_ITEMS, N_OPERATORS));

    // 3. prova via agregação SQL (fonte de verdade é o banco, não o array em
    // memória): cada queue_item tem no máximo 1 work_log ativo, de 1 operador.
    const rows = await ctx.db.execute(sql`
      SELECT queue_item_id, COUNT(DISTINCT operator_id) as distinct_ops, COUNT(*) as total_logs
      FROM work_logs WHERE completed_at IS NULL GROUP BY queue_item_id
    `);
    expect(rows.rows.length).toBe(assignedIds.length);
    for (const row of rows.rows) {
      expect(Number((row as Record<string, unknown>).total_logs)).toBe(1);
      expect(Number((row as Record<string, unknown>).distinct_ops)).toBe(1);
    }

    // 4. itens não atribuídos continuam pending — nada ficou "preso"
    const remainingPending = await ctx.db.execute(sql`SELECT COUNT(*) as c FROM queue_items WHERE status = 'pending'`);
    expect(Number((remainingPending.rows[0] as Record<string, unknown>).c)).toBe(N_ITEMS - assignedIds.length);

    // 5. nenhum item sumiu
    const totalCount = await ctx.db.execute(sql`SELECT COUNT(*) as c FROM queue_items`);
    expect(Number((totalCount.rows[0] as Record<string, unknown>).c)).toBe(N_ITEMS);
  });

  it("quando operadores > itens, o excedente recebe { available: false } sem erro", async () => {
    const batch = await createImportBatch(ctx.db);
    await createManyQueueItems(ctx.db, { batchId: batch.id, count: 5 });
    const operators = await Promise.all(Array.from({ length: 20 }, () => createUser(ctx.db, { role: "operator" })));
    const service = queueService({ repo: queueRepository(ctx.db) });

    const results = await Promise.all(operators.map((op) => service.dequeueNext(op.id)));
    const availableCount = results.filter((r) => r.available).length;
    const unavailableCount = results.filter((r) => !r.available).length;

    expect(availableCount).toBe(5);
    expect(unavailableCount).toBe(15);
  });

  it("prioridade é respeitada sob concorrência: nenhum item de prioridade menor é pego enquanto um de maior prioridade fica pending", async () => {
    const batch = await createImportBatch(ctx.db);
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push(await createQueueItem(ctx.db, { batchId: batch.id, priority: i % 3 }));
    }
    const operators = await Promise.all(Array.from({ length: 4 }, () => createUser(ctx.db, { role: "operator" })));
    const service = queueService({ repo: queueRepository(ctx.db) });

    await Promise.all(operators.map((op) => service.dequeueNext(op.id)));

    const rows = await ctx.db.execute(sql`SELECT id, priority, status FROM queue_items`);
    const assigned = rows.rows.filter((r) => (r as Record<string, unknown>).status !== "pending");
    const pending = rows.rows.filter((r) => (r as Record<string, unknown>).status === "pending");

    const minAssignedPriority = Math.min(...assigned.map((r) => Number((r as Record<string, unknown>).priority)));
    const maxPendingPriority =
      pending.length > 0 ? Math.max(...pending.map((r) => Number((r as Record<string, unknown>).priority))) : -Infinity;

    expect(minAssignedPriority).toBeGreaterThanOrEqual(maxPendingPriority);
  });
});
