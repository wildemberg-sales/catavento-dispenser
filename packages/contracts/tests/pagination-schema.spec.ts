import { describe, expect, it } from "vitest";
import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../src/common/pagination.js";

describe("paginationQuerySchema", () => {
  it("aplica os defaults (page=1, pageSize=20) quando omitidos", () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("rejeita page=0 e page negativo", () => {
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it("aceita page=1 (limite inferior válido)", () => {
    expect(paginationQuerySchema.safeParse({ page: 1 }).success).toBe(true);
  });

  it("rejeita pageSize=0 e pageSize maior que 100", () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("aceita pageSize nos dois limites válidos (1 e 100)", () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 1 }).success).toBe(true);
    expect(paginationQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
  });

  it("rejeita page/pageSize não-inteiros", () => {
    expect(paginationQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: 20.5 }).success).toBe(false);
  });

  it("coage strings numéricas vindas de query params (page/pageSize sempre chegam como string na URL)", () => {
    const result = paginationQuerySchema.safeParse({ page: "2", pageSize: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(50);
    }
  });
});

describe("paginatedResponseSchema", () => {
  const itemSchema = z.object({ id: z.string(), name: z.string() });
  const responseSchema = paginatedResponseSchema(itemSchema);

  it("valida uma resposta paginada completa com os itens tipados", () => {
    const result = responseSchema.safeParse({
      items: [{ id: "1", name: "A" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it("aceita items vazio (página sem resultados)", () => {
    const result = responseSchema.safeParse({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(result.success).toBe(true);
  });

  it("rejeita quando um item do array não bate com o schema informado", () => {
    const result = responseSchema.safeParse({
      items: [{ id: "1" }], // falta 'name'
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita quando total/page/pageSize estão ausentes", () => {
    expect(responseSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
