import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import {
  createCompletedWorkLog,
  createImportBatch,
  createProduct,
  createQueueItem,
  createUser,
  createWorkLog,
} from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

const FROM = new Date("2026-01-01T00:00:00.000Z");
const TO = new Date("2026-02-01T00:00:00.000Z");

describe("GET /admin/reports/operator/:id", () => {
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

  function period() {
    return `from=${encodeURIComponent(FROM.toISOString())}&to=${encodeURIComponent(TO.toISOString())}`;
  }

  it("retorna overview, byProduct, ranking e timeSeries consistentes", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const op1 = await createUser(ctx.db, { username: "op1", role: "operator", displayName: "Operador 1" });
    const op2 = await createUser(ctx.db, { username: "op2", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto Report" });
    const batch = await createImportBatch(ctx.db);

    const item1 = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    const item2 = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    const item3 = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });

    await createCompletedWorkLog(ctx.db, { queueItemId: item1.id, operatorId: op1.id, startedAt: FROM, durationSeconds: 100 });
    await createCompletedWorkLog(ctx.db, {
      queueItemId: item2.id,
      operatorId: op1.id,
      startedAt: new Date(FROM.getTime() + 3600000),
      durationSeconds: 200,
    });
    await createCompletedWorkLog(ctx.db, {
      queueItemId: item3.id,
      operatorId: op2.id,
      startedAt: FROM,
      durationSeconds: 150,
    });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${op1.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report.operator.id).toBe(op1.id);
    expect(report.overview.productivity.completedCount).toBe(2);
    expect(report.overview.productivity.avgDurationSeconds).toBe(150);
    expect(report.byProduct).toHaveLength(1);
    expect(report.byProduct[0].productId).toBe(product.id);
    expect(report.ranking.totalOperatorsRanked).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.timeSeries)).toBe(true);
    await app.close();
  });

  it("operador sem nenhum item concluído no período retorna médias nulas, sem quebrar", async () => {
    await createUser(ctx.db, { username: "admin-sem-completos", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-sem-completos", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });
    await createWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: FROM,
      completedAt: new Date(FROM.getTime() + 1000),
      outcome: "abandoned",
    });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-sem-completos");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${operator.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().overview.productivity.avgDurationSeconds).toBeNull();
    expect(response.json().overview.productivity.completedCount).toBe(0);
    await app.close();
  });

  it("operador sem nenhum work_log no período retorna taxas zeradas (sem divisão por zero)", async () => {
    await createUser(ctx.db, { username: "admin-zero-logs", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-zero-logs", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-zero-logs");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${operator.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().overview.quality.completionRate).toBe(0);
    expect(response.json().overview.quality.problemRate).toBe(0);
    expect(response.json().overview.quality.abandonmentRate).toBe(0);
    await app.close();
  });

  it("item concluído com duração zero (mesmo instante) não gera relativeSpeedIndex/itemsPerHour absurdos", async () => {
    await createUser(ctx.db, { username: "admin-duracao-zero", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-duracao-zero", role: "operator" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    await createCompletedWorkLog(ctx.db, { queueItemId: item.id, operatorId: operator.id, startedAt: FROM, durationSeconds: 0 });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-duracao-zero");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${operator.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().byProduct[0].relativeSpeedIndex).toBeNull();
    expect(response.json().timeSeries[0].itemsPerHour).toBe(0);
    await app.close();
  });

  it("retorna 404 para operador inexistente", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/00000000-0000-4000-8000-000000000000?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 403 para operador autenticado (RBAC)", async () => {
    const op = await createUser(ctx.db, { username: "op3", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${op.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("posição no ranking reflete a ordem correta por weightedRelativeSpeedScore", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const fast = await createUser(ctx.db, { username: "op-fast", role: "operator" });
    const slow = await createUser(ctx.db, { username: "op-slow", role: "operator" });
    const baseline = await createUser(ctx.db, { username: "op-baseline", role: "operator" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);

    async function completeMany(operatorId: string, durationSeconds: number, count: number) {
      for (let i = 0; i < count; i++) {
        const item = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
        await createCompletedWorkLog(ctx.db, {
          queueItemId: item.id,
          operatorId,
          startedAt: new Date(FROM.getTime() + i * 60000),
          durationSeconds,
        });
      }
    }

    await completeMany(fast.id, 50, 3);
    await completeMany(slow.id, 500, 3);
    await completeMany(baseline.id, 200, 3);

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/reports/operator/${fast.id}?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().ranking.positionAmongOperators).toBe(1);
    await app.close();
  });
});
