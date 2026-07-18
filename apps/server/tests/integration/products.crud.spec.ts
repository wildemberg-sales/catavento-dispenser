import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createProduct, createProductImage, createProductSku, createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";

describe("CRUD de produtos (admin)", () => {
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

  it("cria produto com um SKU; ambos os SKUs de fontes diferentes são persistidos", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");

    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Cabo USB-C",
        attributes: { cor: "preto" },
        skus: [
          { source: "mercado_livre", sku: "ML-1" },
          { source: "shopee", sku: "SH-1" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().skus).toHaveLength(2);
    await app.close();
  });

  it("cria produto sem SKUs (rascunho)", async () => {
    await createUser(ctx.db, { username: "admin-rascunho", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-rascunho");

    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Rascunho", attributes: {}, skus: [] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().skus).toEqual([]);
    await app.close();
  });

  it("retorna 409 quando o SKU já pertence a outro produto (violação só descoberta no banco, não no payload)", async () => {
    await createUser(ctx.db, { username: "admin-conflito-create", role: "admin" });
    const existing = await createProduct(ctx.db, { name: "Existente" });
    await createProductSku(ctx.db, { productId: existing.id, source: "mercado_livre", sku: "JA-EXISTE" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-conflito-create");

    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Novo", attributes: {}, skus: [{ source: "mercado_livre", sku: "JA-EXISTE" }] },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("rejeita 2 SKUs da mesma fonte (400)", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin2");

    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Produto X",
        attributes: {},
        skus: [
          { source: "mercado_livre", sku: "A" },
          { source: "mercado_livre", sku: "B" },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");

    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "X", attributes: {}, skus: [] },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("GET /admin/products/:id retorna produto com skus e images; id inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin3", role: "admin" });
    const product = await createProduct(ctx.db, { name: "Produto Y" });
    await createProductSku(ctx.db, { productId: product.id, source: "ebay", sku: "EB-1" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin3");

    const response = await app.inject({
      method: "GET",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().skus).toHaveLength(1);
    expect(response.json().images).toEqual([]);

    const notFound = await app.inject({
      method: "GET",
      url: "/admin/products/00000000-0000-4000-8000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(notFound.statusCode).toBe(404);
    await app.close();
  });

  it("cria produto com assemblyItems e permite atualizar a lista via PUT", async () => {
    await createUser(ctx.db, { username: "admin-bolo", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-bolo");

    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Bolo fake 2 andares",
        assemblyItems: ["Base de isopor 25cm", "Cobertura de pasta americana branca"],
      },
    });
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().assemblyItems).toEqual([
      "Base de isopor 25cm",
      "Cobertura de pasta americana branca",
    ]);

    const productId = createResponse.json().id;
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/admin/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assemblyItems: ["Fita de cetim vermelha"] },
    });
    expect(updateResponse.json().assemblyItems).toEqual(["Fita de cetim vermelha"]);
    await app.close();
  });

  it("PUT sem skus preserva os SKUs existentes; PUT com skus:[] remove todos", async () => {
    await createUser(ctx.db, { username: "admin4", role: "admin" });
    const product = await createProduct(ctx.db, { name: "Produto Z" });
    await createProductSku(ctx.db, { productId: product.id, source: "shopee", sku: "SH-Z" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin4");

    const renamed = await app.inject({
      method: "PUT",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Produto Z Renomeado" },
    });
    expect(renamed.json().name).toBe("Produto Z Renomeado");
    expect(renamed.json().skus).toHaveLength(1);

    const cleared = await app.inject({
      method: "PUT",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { skus: [] },
    });
    expect(cleared.json().skus).toHaveLength(0);
    await app.close();
  });

  it("PUT com SKU já usado por outro produto na mesma fonte retorna 409", async () => {
    await createUser(ctx.db, { username: "admin5", role: "admin" });
    const productA = await createProduct(ctx.db, { name: "A" });
    await createProductSku(ctx.db, { productId: productA.id, source: "mercado_livre", sku: "CONFLITO" });
    const productB = await createProduct(ctx.db, { name: "B" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin5");

    const response = await app.inject({
      method: "PUT",
      url: `/admin/products/${productB.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { skus: [{ source: "mercado_livre", sku: "CONFLITO" }] },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("DELETE faz soft delete (is_active=false); reativação via PUT isActive:true", async () => {
    await createUser(ctx.db, { username: "admin6", role: "admin" });
    const product = await createProduct(ctx.db, { name: "Produto Delete" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin6");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.statusCode).toBe(200);

    const afterDelete = await app.inject({
      method: "GET",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(afterDelete.json().isActive).toBe(false);

    const searchDefault = await app.inject({
      method: "GET",
      url: "/admin/products?search=Produto Delete",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(searchDefault.json().total).toBe(0);

    const reactivate = await app.inject({
      method: "PUT",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: true },
    });
    expect(reactivate.json().isActive).toBe(true);
    await app.close();
  });

  it("busca por nome (ILIKE) e por SKU cadastrado; paginação funciona", async () => {
    await createUser(ctx.db, { username: "admin7", role: "admin" });
    const p1 = await createProduct(ctx.db, { name: "Fone Bluetooth" });
    await createProductSku(ctx.db, { productId: p1.id, source: "mercado_livre", sku: "FONE-01" });
    const p2 = await createProduct(ctx.db, { name: "Mouse sem fio" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin7");

    const byName = await app.inject({
      method: "GET",
      url: "/admin/products?search=bluetooth",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(byName.json().total).toBe(1);

    const bySku = await app.inject({
      method: "GET",
      url: "/admin/products?search=FONE-01",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(bySku.json().total).toBe(1);
    expect(bySku.json().items[0].id).toBe(p1.id);

    const all = await app.inject({
      method: "GET",
      url: "/admin/products?page=1&pageSize=1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(all.json().items).toHaveLength(1);
    expect(all.json().total).toBe(2);
    void p2;
    await app.close();
  });

  it("includeInactive=true inclui produtos desativados na listagem", async () => {
    await createUser(ctx.db, { username: "admin-inactive", role: "admin" });
    await createProduct(ctx.db, { name: "Ativo" });
    await createProduct(ctx.db, { name: "Inativo", isActive: false });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-inactive");

    const defaultList = await app.inject({
      method: "GET",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(defaultList.json().total).toBe(1);

    const withInactive = await app.inject({
      method: "GET",
      url: "/admin/products?includeInactive=true",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(withInactive.json().total).toBe(2);
    await app.close();
  });

  it("DELETE de produto inexistente retorna 404", async () => {
    await createUser(ctx.db, { username: "admin-del404", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-del404");

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/products/00000000-0000-4000-8000-000000000000",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("imagens de um produto vêm ordenadas por position mesmo se inseridas fora de ordem", async () => {
    await createUser(ctx.db, { username: "admin-ordem", role: "admin" });
    const product = await createProduct(ctx.db, { name: "Produto com imagens" });
    await createProductImage(ctx.db, { productId: product.id, url: "memory://z.png", position: 2 });
    await createProductImage(ctx.db, { productId: product.id, url: "memory://a.png", position: 0 });
    await createProductImage(ctx.db, { productId: product.id, url: "memory://m.png", position: 1 });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-ordem");

    const response = await app.inject({
      method: "GET",
      url: `/admin/products/${product.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().images.map((i: { url: string }) => i.url)).toEqual([
      "memory://a.png",
      "memory://m.png",
      "memory://z.png",
    ]);
    await app.close();
  });
});
