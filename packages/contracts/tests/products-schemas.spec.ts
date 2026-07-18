import { describe, expect, it } from "vitest";
import {
  createProductInputSchema,
  linkQueueItemInputSchema,
  listProductsQuerySchema,
} from "../src/products/schemas.js";

describe("products schemas", () => {
  it("createProductInputSchema aceita produto sem SKUs (rascunho)", () => {
    const result = createProductInputSchema.safeParse({ name: "Produto X", attributes: {}, skus: [] });
    expect(result.success).toBe(true);
  });

  it("createProductInputSchema rejeita dois SKUs da mesma fonte no mesmo produto", () => {
    const result = createProductInputSchema.safeParse({
      name: "Produto X",
      attributes: {},
      skus: [
        { source: "mercado_livre", sku: "A1" },
        { source: "mercado_livre", sku: "A2" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("createProductInputSchema aceita SKUs de fontes diferentes", () => {
    const result = createProductInputSchema.safeParse({
      name: "Produto X",
      attributes: {},
      skus: [
        { source: "mercado_livre", sku: "A1" },
        { source: "shopee", sku: "B1" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("createProductInputSchema aceita assemblyItems e usa lista vazia como default", () => {
    const comItens = createProductInputSchema.safeParse({
      name: "Bolo de aniversário",
      assemblyItems: ["Base de isopor 25cm", "Cobertura de pasta americana branca"],
    });
    expect(comItens.success).toBe(true);
    if (comItens.success) {
      expect(comItens.data.assemblyItems).toEqual(["Base de isopor 25cm", "Cobertura de pasta americana branca"]);
    }

    const semItens = createProductInputSchema.safeParse({ name: "Bolo sem lista" });
    expect(semItens.success).toBe(true);
    if (semItens.success) {
      expect(semItens.data.assemblyItems).toEqual([]);
    }
  });

  it("createProductInputSchema rejeita item de montagem vazio na lista", () => {
    const result = createProductInputSchema.safeParse({
      name: "Bolo X",
      assemblyItems: ["Base de isopor", ""],
    });
    expect(result.success).toBe(false);
  });

  it("listProductsQuerySchema aplica defaults de paginação", () => {
    const result = listProductsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.includeInactive).toBe(false);
    }
  });

  it("linkQueueItemInputSchema rejeita productId que não é uuid", () => {
    expect(linkQueueItemInputSchema.safeParse({ productId: "nao-e-uuid" }).success).toBe(false);
    expect(linkQueueItemInputSchema.safeParse({ productId: "3f5a1e2a-0000-4000-8000-000000000000" }).success).toBe(true);
  });
});
