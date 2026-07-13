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

describe("GET /admin/analytics/by-operator", () => {
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

  it("calcula completedCount e avgDurationSeconds corretamente para cada operador", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op1", role: "operator", displayName: "Operador 1" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);

    const items = await Promise.all(
      [100, 200, 300].map(() => createQueueItem(ctx.db, { batchId: batch.id, productId: product.id }))
    );
    await Promise.all(
      items.map((item, i) =>
        createCompletedWorkLog(ctx.db, {
          queueItemId: item.id,
          operatorId: operator.id,
          startedAt: new Date(FROM.getTime() + i * 60000),
          durationSeconds: [100, 200, 300][i]!,
        })
      )
    );

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-operator?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const row = response.json().items.find((r: { operatorId: string }) => r.operatorId === operator.id);
    expect(row.completedCount).toBe(3);
    expect(row.avgDurationSeconds).toBe(200);
    await app.close();
  });

  it("conta abandonedCount/problemCount/inProgressCount e completionRate corretamente", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op2", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const items = await Promise.all(Array.from({ length: 4 }, () => createQueueItem(ctx.db, { batchId: batch.id })));

    await createCompletedWorkLog(ctx.db, {
      queueItemId: items[0]!.id,
      operatorId: operator.id,
      startedAt: new Date(FROM.getTime() + 1000),
      durationSeconds: 60,
    });
    await createWorkLog(ctx.db, {
      queueItemId: items[1]!.id,
      operatorId: operator.id,
      startedAt: new Date(FROM.getTime() + 2000),
      completedAt: new Date(FROM.getTime() + 3000),
      outcome: "abandoned",
    });
    await createWorkLog(ctx.db, {
      queueItemId: items[2]!.id,
      operatorId: operator.id,
      startedAt: new Date(FROM.getTime() + 4000),
      completedAt: new Date(FROM.getTime() + 5000),
      outcome: "problem",
    });
    await createWorkLog(ctx.db, {
      queueItemId: items[3]!.id,
      operatorId: operator.id,
      startedAt: new Date(FROM.getTime() + 6000),
      completedAt: null,
    });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-operator?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const row = response.json().items.find((r: { operatorId: string }) => r.operatorId === operator.id);
    expect(row.completedCount).toBe(1);
    expect(row.abandonedCount).toBe(1);
    expect(row.problemCount).toBe(1);
    expect(row.inProgressCount).toBe(1);
    expect(row.completionRate).toBeCloseTo(0.25, 5);
    await app.close();
  });

  it("ignora work_logs fora do período consultado", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op3", role: "operator" });
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id });

    await createCompletedWorkLog(ctx.db, {
      queueItemId: item.id,
      operatorId: operator.id,
      startedAt: new Date("2020-01-01T00:00:00.000Z"),
      durationSeconds: 60,
    });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-operator?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const row = response.json().items.find((r: { operatorId: string }) => r.operatorId === operator.id);
    expect(row).toBeUndefined();
    await app.close();
  });

  it("retorna 400 quando o range excede o limite configurado", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const app = await buildTestApp(ctx.db, { ANALYTICS_MAX_RANGE_DAYS: 10 });
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-operator?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op4", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op4");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-operator?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
