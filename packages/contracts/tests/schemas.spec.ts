import { describe, expect, it } from "vitest";
import { loginInputSchema } from "../src/auth/schemas.js";
import {
  adminQueueQuerySchema,
  nextItemResponseSchema,
  problemItemInputSchema,
  queueItemDtoSchema,
  sourceTypeSchema,
  updatePriorityRulesInputSchema,
} from "../src/queue/schemas.js";

describe("auth schemas", () => {
  it("loginInputSchema rejeita username vazio", () => {
    const result = loginInputSchema.safeParse({ username: "", password: "abc123" });
    expect(result.success).toBe(false);
  });

  it("loginInputSchema aceita credenciais válidas", () => {
    const result = loginInputSchema.safeParse({ username: "admin", password: "abc123" });
    expect(result.success).toBe(true);
  });
});

describe("queue schemas", () => {
  it("sourceTypeSchema aceita as 3 fontes conhecidas", () => {
    expect(sourceTypeSchema.safeParse("mercado_livre").success).toBe(true);
    expect(sourceTypeSchema.safeParse("shopee").success).toBe(true);
    expect(sourceTypeSchema.safeParse("ebay").success).toBe(true);
  });

  it("sourceTypeSchema rejeita fonte desconhecida", () => {
    expect(sourceTypeSchema.safeParse("aliexpress").success).toBe(false);
  });

  it("nextItemResponseSchema exige item quando available=true", () => {
    const withoutItem = nextItemResponseSchema.safeParse({ available: true });
    expect(withoutItem.success).toBe(false);
  });

  it("nextItemResponseSchema aceita available=true com item válido", () => {
    const item = {
      id: "3f5a1e2a-0000-4000-8000-000000000000",
      externalRef: "SKU-1",
      source: "mercado_livre",
      productId: null,
      payload: { nome: "Produto teste" },
      priority: 0,
      status: "in_progress",
      createdAt: new Date().toISOString(),
      product: null,
    };
    const result = nextItemResponseSchema.safeParse({ available: true, item });
    expect(result.success).toBe(true);
  });

  it("nextItemResponseSchema rejeita item presente quando available=false", () => {
    const result = nextItemResponseSchema.safeParse({
      available: false,
      item: { id: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("nextItemResponseSchema aceita available=false sem item", () => {
    const result = nextItemResponseSchema.safeParse({ available: false });
    expect(result.success).toBe(true);
  });

  it("problemItemInputSchema rejeita nota vazia", () => {
    expect(problemItemInputSchema.safeParse({ note: "" }).success).toBe(false);
  });

  it("problemItemInputSchema rejeita nota maior que 1000 caracteres", () => {
    expect(problemItemInputSchema.safeParse({ note: "a".repeat(1001) }).success).toBe(false);
  });

  it("problemItemInputSchema aceita nota válida", () => {
    expect(problemItemInputSchema.safeParse({ note: "Peça quebrada" }).success).toBe(true);
  });

  it("queueItemDtoSchema exige productId nulo ou uuid", () => {
    const base = {
      id: "3f5a1e2a-0000-4000-8000-000000000000",
      externalRef: "SKU-1",
      source: "shopee",
      payload: {},
      priority: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
      product: null,
    };
    expect(queueItemDtoSchema.safeParse({ ...base, productId: null }).success).toBe(true);
    expect(queueItemDtoSchema.safeParse({ ...base, productId: "not-a-uuid" }).success).toBe(false);
  });

  it("queueItemDtoSchema exige o campo product (nulo quando sem vínculo, preenchido quando vinculado)", () => {
    const base = {
      id: "3f5a1e2a-0000-4000-8000-000000000000",
      externalRef: "SKU-1",
      source: "shopee",
      productId: "3f5a1e2a-0000-4000-8000-000000000001",
      payload: {},
      priority: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // product é obrigatório no schema (mesmo que nullable) — omiti-lo falha.
    expect(queueItemDtoSchema.safeParse(base).success).toBe(false);

    const withNullProduct = queueItemDtoSchema.safeParse({ ...base, product: null });
    expect(withNullProduct.success).toBe(true);
    if (withNullProduct.success) {
      expect(withNullProduct.data.product).toBeNull();
    }

    const withProduct = queueItemDtoSchema.safeParse({
      ...base,
      product: {
        id: base.productId,
        name: "Produto vinculado",
        description: null,
        attributes: {},
        assemblyItems: ["Base de isopor 25cm"],
        images: [{ url: "http://x/1.png", position: 0 }],
        createdAt: new Date().toISOString(),
      },
    });
    expect(withProduct.success).toBe(true);
  });

  it("updatePriorityRulesInputSchema exige exatamente as 3 fontes, sem repetir", () => {
    const complete = {
      rules: [
        { source: "mercado_livre", priority: 2, isActive: true },
        { source: "shopee", priority: 1, isActive: true },
        { source: "ebay", priority: 0, isActive: true },
      ],
    };
    expect(updatePriorityRulesInputSchema.safeParse(complete).success).toBe(true);

    const missingOne = { rules: complete.rules.slice(0, 2) };
    expect(updatePriorityRulesInputSchema.safeParse(missingOne).success).toBe(false);

    const duplicated = { rules: [complete.rules[0], complete.rules[0], complete.rules[1]] };
    expect(updatePriorityRulesInputSchema.safeParse(duplicated).success).toBe(false);
  });

  it("adminQueueQuerySchema aplica defaults de paginação e aceita filtros opcionais", () => {
    const result = adminQueueQuerySchema.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
    expect(adminQueueQuerySchema.safeParse({}).success).toBe(true);
    expect(adminQueueQuerySchema.safeParse({ status: "invalido" }).success).toBe(false);
  });
});
