import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { buildMultipartBody } from "../setup/multipart.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/imports");

describe("POST /imports", () => {
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

  function uploadFixture(app: Awaited<ReturnType<typeof buildTestApp>>, token: string, filename: string) {
    const content = readFileSync(path.join(FIXTURES_DIR, filename));
    const { body, contentType } = buildMultipartBody({ fieldName: "file", filename, content });
    return app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
  }

  it("cria o batch e as linhas de staging a partir de um CSV válido", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await uploadFixture(app, token, "valid-simple.csv");

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.totalRows).toBe(5);
    expect(body.validRows).toBe(5);
    expect(body.rejectedRows).toBe(0);
    expect(body.suggestedMapping.externalRef).toBe("SKU");
    expect(body.suggestedMapping.source).toBe("Fonte");

    const [batch] = await ctx.db
      .select()
      .from(schema.importBatches)
      .where(eq(schema.importBatches.id, body.batchId));
    expect(batch?.status).toBe("processing");

    const rows = await ctx.db
      .select()
      .from(schema.importBatchRows)
      .where(eq(schema.importBatchRows.batchId, body.batchId));
    expect(rows).toHaveLength(5);

    // Nenhum queue_item deve existir ainda — "sem persistir ainda" = sem afetar a fila.
    const queueItems = await ctx.db.select().from(schema.queueItems);
    expect(queueItems).toHaveLength(0);
    await app.close();
  });

  it("contabiliza corretamente linhas válidas/rejeitadas em um CSV misto", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await uploadFixture(app, token, "mixed-valid-invalid.csv");
    const body = response.json();

    expect(body.totalRows).toBe(5);
    expect(body.validRows).toBe(2); // ITEM-1 (primeira ocorrência) e ITEM-5
    expect(body.rejectedRows).toBe(3); // sku vazio, fonte desconhecida, duplicata
    await app.close();
  });

  it("aceita um CSV só com cabeçalho (zero linhas de dados) sem erro", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await uploadFixture(app, token, "header-only.csv");
    expect(response.statusCode).toBe(201);
    expect(response.json().totalRows).toBe(0);
    expect(response.json().validRows).toBe(0);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await uploadFixture(app, token, "valid-simple.csv");
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("retorna 401 sem token", async () => {
    const app = await buildTestApp(ctx.db);
    const content = readFileSync(path.join(FIXTURES_DIR, "valid-simple.csv"));
    const { body, contentType } = buildMultipartBody({ fieldName: "file", filename: "valid-simple.csv", content });
    const response = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { "content-type": contentType },
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 400 quando nenhum arquivo é enviado", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const boundary = "----no-file-boundary";
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="campo"\r\n\r\nvalor\r\n--${boundary}--\r\n`
    );
    const response = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("NO_FILE_UPLOADED");
    await app.close();
  });
});
