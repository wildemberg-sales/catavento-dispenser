import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createImportBatch, createUser, DEFAULT_PRIORITY_RULES, setPriorityRules } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { buildMultipartBody } from "../setup/multipart.js";

describe("PUT /admin/queue/rules", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await startTestDb();
  }, 60000);

  afterAll(async () => {
    await stopTestDb(ctx);
  });

  beforeEach(async () => {
    await truncateAll(ctx.db);
    await setPriorityRules(ctx.db, DEFAULT_PRIORITY_RULES);
  });

  async function loginAs(app: Awaited<ReturnType<typeof buildTestApp>>, username: string) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "senha-de-teste-123" },
    });
    return response.json().accessToken as string;
  }

  it("atualiza as 3 regras de prioridade", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "PUT",
      url: "/admin/queue/rules",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rules: [
          { source: "mercado_livre", priority: 5, isActive: true },
          { source: "shopee", priority: 3, isActive: true },
          { source: "ebay", priority: 1, isActive: true },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const bySource = Object.fromEntries(
      response.json().rules.map((r: { source: string; priority: number }) => [r.source, r.priority])
    );
    expect(bySource.mercado_livre).toBe(5);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "PUT",
      url: "/admin/queue/rules",
      headers: { authorization: `Bearer ${token}` },
      payload: { rules: DEFAULT_PRIORITY_RULES.map((r) => ({ ...r, isActive: true })) },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("retorna 400 quando falta uma fonte", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "PUT",
      url: "/admin/queue/rules",
      headers: { authorization: `Bearer ${token}` },
      payload: { rules: [{ source: "mercado_livre", priority: 5, isActive: true }] },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("uma nova importação confirmada usa as regras atualizadas", async () => {
    const admin = await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    await app.inject({
      method: "PUT",
      url: "/admin/queue/rules",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        rules: [
          { source: "mercado_livre", priority: 50, isActive: true },
          { source: "shopee", priority: 1, isActive: true },
          { source: "ebay", priority: 0, isActive: true },
        ],
      },
    });

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "lote.csv",
      content: "SKU,Fonte\nITEM-1,mercado_livre\n",
    });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const { batchId, suggestedMapping } = previewResponse.json();

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/admin/imports/${batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: suggestedMapping },
    });
    expect(confirmResponse.statusCode).toBe(200);

    const itemsResponse = await app.inject({
      method: "GET",
      url: `/admin/queue?batchId=${batchId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(itemsResponse.json().items[0].priority).toBe(50);
    await app.close();
    void admin;
  });
});
