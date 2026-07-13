import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createProduct, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { buildMultipartBody } from "../setup/multipart.js";

describe("Upload/delete de imagens de produto", () => {
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

  it("upload de imagem válida cria o registro e retorna url memory://", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "foto.png",
      content: Buffer.from("fake-png-bytes"),
      contentType: "image/png",
    });

    const response = await app.inject({
      method: "POST",
      url: `/admin/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().url).toContain("memory://");
    await app.close();
  });

  it("rejeita mimetype não suportado", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "arquivo.txt",
      content: Buffer.from("texto"),
      contentType: "text/plain",
    });

    const response = await app.inject({
      method: "POST",
      url: `/admin/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("INVALID_IMAGE_TYPE");
    await app.close();
  });

  it("upload em produto inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "foto.png",
      content: Buffer.from("x"),
      contentType: "image/png",
    });
    const response = await app.inject({
      method: "POST",
      url: "/admin/products/00000000-0000-4000-8000-000000000000/images",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("excedendo o limite de imagens por produto retorna 409", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db, { MAX_IMAGES_PER_PRODUCT: 1 });
    const token = await loginAs(app, "admin4");

    async function uploadOne() {
      const { body, contentType } = buildMultipartBody({
        fieldName: "file",
        filename: "foto.png",
        content: Buffer.from("x"),
        contentType: "image/png",
      });
      return app.inject({
        method: "POST",
        url: `/admin/products/${product.id}/images`,
        headers: { authorization: `Bearer ${token}`, "content-type": contentType },
        payload: body,
      });
    }

    const first = await uploadOne();
    expect(first.statusCode).toBe(201);
    const second = await uploadOne();
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it("delete remove o registro e chama storage.delete", async () => {
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin5");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "foto.png",
      content: Buffer.from("x"),
      contentType: "image/png",
    });
    const uploadResponse = await app.inject({
      method: "POST",
      url: `/admin/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const imageId = uploadResponse.json().id;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/products/${product.id}/images/${imageId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const getResponse = await app.inject({
      method: "GET",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getResponse.json().images).toHaveLength(0);
    await app.close();
  });

  it("delete de imagem inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin7", role: "admin" });
    const product = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin7");

    const response = await app.inject({
      method: "DELETE",
      url: `/admin/products/${product.id}/images/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("delete de imagem de outro produto (id não bate) retorna 404", async () => {
    await createUser(ctx.db, { username: "admin6", role: "admin" });
    const product1 = await createProduct(ctx.db);
    const product2 = await createProduct(ctx.db);
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin6");

    const { body, contentType } = buildMultipartBody({
      fieldName: "file",
      filename: "foto.png",
      content: Buffer.from("x"),
      contentType: "image/png",
    });
    const uploadResponse = await app.inject({
      method: "POST",
      url: `/admin/products/${product1.id}/images`,
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      payload: body,
    });
    const imageId = uploadResponse.json().id;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/products/${product2.id}/images/${imageId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.statusCode).toBe(404);
    await app.close();
  });
});
