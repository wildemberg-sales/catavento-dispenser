import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createCompletedWorkLog, createImportBatch, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("GET /admin/analytics/throughput", () => {
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

  it("agrupa por dia e preenche buckets vazios com completedCount 0", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op1", role: "operator" });
    const batch = await createImportBatch(ctx.db);

    const day1 = new Date("2026-01-01T10:00:00.000Z");
    const day3 = new Date("2026-01-03T10:00:00.000Z");

    const item1 = await createQueueItem(ctx.db, { batchId: batch.id });
    const item2 = await createQueueItem(ctx.db, { batchId: batch.id });
    await createCompletedWorkLog(ctx.db, { queueItemId: item1.id, operatorId: operator.id, startedAt: day1, durationSeconds: 60 });
    await createCompletedWorkLog(ctx.db, { queueItemId: item2.id, operatorId: operator.id, startedAt: day3, durationSeconds: 60 });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const from = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const to = new Date("2026-01-04T00:00:00.000Z").toISOString();
    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/throughput?bucket=day&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const items = response.json().items;
    expect(items.length).toBeGreaterThanOrEqual(3);
    const counts = items.map((i: { completedCount: number }) => i.completedCount);
    expect(counts.filter((c: number) => c === 0).length).toBeGreaterThanOrEqual(1);
    expect(counts.reduce((a: number, b: number) => a + b, 0)).toBe(2);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op2", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op2");

    const from = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const to = new Date("2026-01-04T00:00:00.000Z").toISOString();
    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/throughput?bucket=day&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
