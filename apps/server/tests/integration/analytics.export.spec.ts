import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createCompletedWorkLog, createImportBatch, createProduct, createQueueItem, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

const FROM = new Date("2026-01-01T00:00:00.000Z");
const TO = new Date("2026-02-01T00:00:00.000Z");

describe("GET /admin/analytics/export", () => {
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

  async function seedOneCompletedItem() {
    const operator = await createUser(ctx.db, { username: "op-export", role: "operator", displayName: "Operador Export" });
    const product = await createProduct(ctx.db);
    const batch = await createImportBatch(ctx.db);
    const item = await createQueueItem(ctx.db, { batchId: batch.id, productId: product.id });
    await createCompletedWorkLog(ctx.db, { queueItemId: item.id, operatorId: operator.id, startedAt: FROM, durationSeconds: 90 });
    return operator;
  }

  it("format=csv retorna text/csv parseável de volta com os dados esperados", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    await seedOneCompletedItem();
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=by-operator&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    const records = parse(response.rawPayload, { columns: true, bom: true }) as Array<Record<string, string>>;
    expect(records.some((r) => r["Operador"] === "Operador Export")).toBe(true);
    await app.close();
  });

  it("format=xlsx retorna um buffer válido lido de volta com exceljs", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await seedOneCompletedItem();
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=xlsx&report=by-operator&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("spreadsheetml");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.rawPayload as unknown as Buffer);
    const sheet = workbook.worksheets[0]!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Operador Export");
    await app.close();
  });

  it("report=by-product exporta corretamente", async () => {
    await createUser(ctx.db, { username: "admin-byproduct", role: "admin" });
    await seedOneCompletedItem();
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-byproduct");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=by-product&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const records = parse(response.rawPayload, { columns: true, bom: true }) as Array<Record<string, string>>;
    expect(records.length).toBe(1);
    await app.close();
  });

  it("report=throughput exporta corretamente", async () => {
    await createUser(ctx.db, { username: "admin-throughput", role: "admin" });
    await seedOneCompletedItem();
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-throughput");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=throughput&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const records = parse(response.rawPayload, { columns: true, bom: true }) as Array<Record<string, string>>;
    expect(records.length).toBeGreaterThan(0);
    await app.close();
  });

  it("report=operator-report sem operatorId retorna 400", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=operator-report&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("MISSING_OPERATOR_ID");
    await app.close();
  });

  it("report=operator-report com operatorId exporta a quebra por produto", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const operator = await seedOneCompletedItem();
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=operator-report&operatorId=${operator.id}&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const records = parse(response.rawPayload, { columns: true, bom: true }) as Array<Record<string, string>>;
    expect(records.length).toBeGreaterThan(0);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "GET",
      url: `/admin/analytics/export?format=csv&report=by-operator&${period()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
