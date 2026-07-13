import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createCompletedWorkLog, createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { analyticsRepository } from "../../src/modules/analytics/analytics.repository.js";

const FROM = new Date("2026-01-01T00:00:00.000Z").toISOString();
const TO = new Date("2026-02-01T00:00:00.000Z").toISOString();

describe("Comparação justa por produto (teste de justiça — Seção 6.6.1)", () => {
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

  it("operador que só pega produtos difíceis não é penalizado frente a quem só pega produtos fáceis, quando ambos estão na média da equipe em seus produtos", async () => {
    const operatorA = await createUser(ctx.db, { username: "operador-dificil", role: "operator" });
    const operatorB = await createUser(ctx.db, { username: "operador-facil", role: "operator" });
    const baseline = await createUser(ctx.db, { username: "operador-baseline", role: "operator" });

    const hardProduct = await createProduct(ctx.db, { name: "Produto Difícil" });
    const easyProduct = await createProduct(ctx.db, { name: "Produto Fácil" });
    const batch = await createImportBatch(ctx.db);

    let t = 0;
    async function complete(operatorId: string, productId: string, durationSeconds: number) {
      const item = await createQueueItem(ctx.db, { batchId: batch.id, productId });
      await createCompletedWorkLog(ctx.db, {
        queueItemId: item.id,
        operatorId,
        startedAt: new Date(new Date(FROM).getTime() + t * 60000),
        durationSeconds,
      });
      t++;
    }

    // Operador A: só produto difícil, 5 itens a ~600s (na média da equipe nesse produto).
    for (let i = 0; i < 5; i++) await complete(operatorA.id, hardProduct.id, 600);
    // Baseline também trabalha no produto difícil, a mesma média (~600s) — forma "a equipe".
    for (let i = 0; i < 5; i++) await complete(baseline.id, hardProduct.id, 600);

    // Operador B: só produto fácil, 5 itens a ~60s (na média da equipe nesse produto).
    for (let i = 0; i < 5; i++) await complete(operatorB.id, easyProduct.id, 60);
    // Baseline também trabalha no produto fácil, a mesma média (~60s).
    for (let i = 0; i < 5; i++) await complete(baseline.id, easyProduct.id, 60);

    const repo = analyticsRepository(ctx.db);
    const scores = await repo.getWeightedRelativeSpeedScores(FROM, TO);

    const scoreA = scores.get(operatorA.id);
    const scoreB = scores.get(operatorB.id);

    // Ambos devem convergir para ~1.0 (na média da equipe em seus respectivos produtos).
    expect(scoreA).toBeCloseTo(1.0, 1);
    expect(scoreB).toBeCloseTo(1.0, 1);

    // Prova de que um ranking por tempo médio bruto seria injusto: A (600s)
    // pareceria muito pior que B (60s), mas o score correto não reflete isso.
    const { items: byOperatorRaw } = await repo.getByOperator(FROM, TO, { page: 1, pageSize: 10 });
    const rawA = byOperatorRaw.find((r) => r.operatorId === operatorA.id)!;
    const rawB = byOperatorRaw.find((r) => r.operatorId === operatorB.id)!;
    expect(rawA.avgDurationSeconds).toBeGreaterThan(rawB.avgDurationSeconds!);
    expect(Math.abs(scoreA! - scoreB!)).toBeLessThan(0.2);
  });

  it("piso de amostra mínima: operador com 1 único item de um produto raro não entra no score agregado", async () => {
    const operator = await createUser(ctx.db, { username: "op-raro", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto Raro" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    await createCompletedWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: new Date(FROM),
      durationSeconds: 100,
    });

    const repo = analyticsRepository(ctx.db);
    const scores = await repo.getWeightedRelativeSpeedScores(FROM, TO);
    expect(scores.has(operator.id)).toBe(false);
  });
});
