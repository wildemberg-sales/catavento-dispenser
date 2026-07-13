import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { buildMultipartBody } from "../setup/multipart.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/imports");

describe("GET /imports e /imports/:id", () => {
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

  async function upload(app: Awaited<ReturnType<typeof buildTestApp>>, token: string) {
    const content = readFileSync(path.join(FIXTURES_DIR, "mixed-valid-invalid.csv"));
    const { body, contentType } = buildMultipartBody({ fieldName: "file", filename: "mixed-valid-invalid.csv", content });
    const response = await app.inject({
      method: "POST",
      url: "/admin/imports",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    return response.json();
  }

  it("GET /imports lista lotes paginados; operador recebe 403", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const adminToken = await loginAs(app, "admin1");
    await upload(app, adminToken);

    const response = await app.inject({ method: "GET", url: "/admin/imports", headers: { authorization: `Bearer ${adminToken}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(1);

    const opToken = await loginAs(app, "op1");
    const forbidden = await app.inject({ method: "GET", url: "/admin/imports", headers: { authorization: `Bearer ${opToken}` } });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it("GET /imports/:id retorna estatísticas do lote; id inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");
    const preview = await upload(app, token);

    const response = await app.inject({
      method: "GET",
      url: `/admin/imports/${preview.batchId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().totalItems).toBe(5);
    expect(response.json().validItems).toBe(2);

    const notFound = await app.inject({
      method: "GET",
      url: "/admin/imports/00000000-0000-4000-8000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notFound.statusCode).toBe(404);
    await app.close();
  });

  it("GET /imports/:id/rows filtra por status válido/inválido", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");
    const preview = await upload(app, token);

    const valid = await app.inject({
      method: "GET",
      url: `/admin/imports/${preview.batchId}/rows?status=valid`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(valid.json().total).toBe(2);

    const invalid = await app.inject({
      method: "GET",
      url: `/admin/imports/${preview.batchId}/rows?status=invalid`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(invalid.json().total).toBe(3);

    const all = await app.inject({
      method: "GET",
      url: `/admin/imports/${preview.batchId}/rows`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(all.json().total).toBe(5);
    await app.close();
  });

  it("GET /imports/:id/rows para batchId inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const response = await app.inject({
      method: "GET",
      url: "/admin/imports/00000000-0000-4000-8000-000000000000/rows",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
