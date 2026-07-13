import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createCompletedWorkLog, createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

const FROM = new Date("2026-01-01T00:00:00.000Z");
const TO = new Date("2026-02-01T00:00:00.000Z");

describe("GET /admin/analytics/by-product", () => {
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

  it("calcula tempo médio, desvio padrão e nº de operadores distintos por produto", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const op1 = await createUser(ctx.db, { username: "op1", role: "operator" });
    const op2 = await createUser(ctx.db, { username: "op2", role: "operator" });
    const product = await createProduct(ctx.db, { name: "Produto Analisado" });
    const batch = await createImportBatch(ctx.db);

    const item1 = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    const item2 = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });

    await createCompletedWorkLog(ctx.db, {
      queueItemId: item1.id,
      operatorId: op1.id,
      startedAt: FROM,
      durationSeconds: 100,
    });
    await createCompletedWorkLog(ctx.db, {
      queueItemId: item2.id,
      operatorId: op2.id,
      startedAt: new Date(FROM.getTime() + 1000),
      durationSeconds: 200,
    });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-product?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const row = response.json().items.find((r: { productId: string }) => r.productId === product.id);
    expect(row.completedCount).toBe(2);
    expect(row.avgDurationSeconds).toBe(150);
    expect(row.distinctOperators).toBe(2);
    await app.close();
  });

  it("produto sem nenhum item concluído no período não aparece na listagem", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await createProduct(ctx.db, { name: "Produto Sem Atividade" });

    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-product?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().total).toBe(0);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op3", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/by-product?${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
