import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser, DEFAULT_PRIORITY_RULES, setPriorityRules } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { buildMultipartBody } from "../setup/multipart.js";
import { monitorBus } from "../../src/lib/monitor-bus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/imports");

describe("POST /imports/:id/confirm", () => {
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

  async function upload(app: Awaited<ReturnType<typeof buildTestApp>>, token: string, filename: string) {
    const content = readFileSync(path.join(FIXTURES_DIR, filename));
    const { body, contentType } = buildMultipartBody({ fieldName: "file", filename, content });
    const response = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    return response.json();
  }

  it("cria queue_items para as linhas válidas, aplicando a regra de prioridade por fonte", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");
    const preview = await upload(app, token, "valid-simple.csv");

    const response = await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ready");
    expect(response.json().validItems).toBe(5);

    const items = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.batchId, preview.batchId));
    expect(items).toHaveLength(5);

    const mlItem = items.find((i) => i.source === "mercado_livre");
    const shopeeItem = items.find((i) => i.source === "shopee");
    const ebayItem = items.find((i) => i.source === "ebay");
    expect(mlItem?.priority).toBe(2);
    expect(shopeeItem?.priority).toBe(1);
    expect(ebayItem?.priority).toBe(0);
    await app.close();
  });

  it("override explícito de prioridade no arquivo vence a regra da fonte", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "com-prioridade.csv",
      content: "SKU,Fonte,Prioridade\nITEM-X,shopee,77\n",
    });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const preview = previewResponse.json();

    await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    const [item] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.batchId, preview.batchId));
    expect(item?.priority).toBe(77);
    await app.close();
  });

  it("revalida com o mapeamento definitivo, diferente do sugerido", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "duas-colunas-ref.csv",
      content: "CodigoA,CodigoB,Fonte\nAAA,BBB,mercado_livre\n",
    });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const preview = previewResponse.json();

    // Mapeamento definitivo aponta external_ref para CodigoB, não o sugerido (CodigoA)
    const definitiveMapping = { ...preview.suggestedMapping, externalRef: "CodigoB" };

    await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: definitiveMapping },
    });

    const [item] = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.batchId, preview.batchId));
    expect(item?.externalRef).toBe("BBB");
    await app.close();
  });

  it("lote 100% inválido é marcado como failed e nenhum queue_item é criado", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "tudo-invalido.csv",
      content: "SKU,Fonte\n,mercado_livre\n",
    });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const preview = previewResponse.json();

    const response = await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    expect(response.json().status).toBe("failed");
    const items = await ctx.db.select().from(schema.queueItems).where(eq(schema.queueItems.batchId, preview.batchId));
    expect(items).toHaveLength(0);
    await app.close();
  });

  it("retorna 404 para batchId inexistente", async () => {
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin5");

    const response = await app.inject({
      method: "POST",
      url: "/admin/imports/00000000-0000-4000-8000-000000000000/confirm",
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: { externalRef: "SKU", source: "Fonte", payloadFields: [] } },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("retorna 409 ao confirmar um lote já confirmado", async () => {
    await createUser(ctx.db, { username: "admin6", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin6");
    const preview = await upload(app, token, "valid-simple.csv");

    await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    const secondResponse = await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });
    expect(secondResponse.statusCode).toBe(409);
    await app.close();
  });

  it("publica queue_size_changed quando linhas válidas são enfileiradas", async () => {
    await createUser(ctx.db, { username: "admin-confirma-evento", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-confirma-evento");
    const preview = await upload(app, token, "valid-simple.csv");
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    expect(publishSpy).toHaveBeenCalledWith({ type: "queue_size_changed", payload: { queueSize: 5 } });
    publishSpy.mockRestore();
    await app.close();
  });

  it("NÃO publica queue_size_changed quando nenhuma linha válida é enfileirada", async () => {
    await createUser(ctx.db, { username: "admin-confirma-vazio", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-confirma-vazio");
    const preview = await upload(app, token, "header-only.csv");
    const publishSpy = vi.spyOn(monitorBus, "publish");

    await app.inject({
      method: "POST",
      url: `/admin/imports/${preview.batchId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnMapping: preview.suggestedMapping },
    });

    expect(publishSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "queue_size_changed" }));
    publishSpy.mockRestore();
    await app.close();
  });
});
