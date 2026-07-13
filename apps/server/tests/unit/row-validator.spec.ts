import { describe, expect, it } from "vitest";
import { validateRow } from "../../src/modules/imports/row-validator.js";

const mapping = {
  externalRef: "SKU",
  source: "Fonte",
  priority: "Prioridade",
  payloadFields: ["Nome"],
};

describe("validateRow", () => {
  it("linha com external_ref e source válidos é válida", () => {
    const result = validateRow(
      { SKU: "ABC1", Fonte: "mercado_livre", Nome: "Produto A" },
      1,
      mapping,
      new Set()
    );
    expect(result.isValid).toBe(true);
    expect(result.rejectionReason).toBeNull();
    expect(result.externalRef).toBe("ABC1");
    expect(result.source).toBe("mercado_livre");
    expect(result.payload).toEqual({ Nome: "Produto A" });
  });

  it("rejeita quando external_ref está vazio", () => {
    const result = validateRow({ SKU: "", Fonte: "mercado_livre" }, 1, mapping, new Set());
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain("Código do produto");
  });

  it("rejeita quando a coluna de source está totalmente ausente na linha", () => {
    const result = validateRow({ SKU: "ABC1" }, 1, mapping, new Set());
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toBe("Fonte (source) ausente.");
  });

  it("rejeita quando source tem valor desconhecido", () => {
    const result = validateRow({ SKU: "ABC1", Fonte: "aliexpress" }, 1, mapping, new Set());
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain("aliexpress");
  });

  it("normaliza sinônimos de fonte (Mercado Livre, ML, mercadolivre) para mercado_livre", () => {
    for (const value of ["Mercado Livre", "ML", "mercadolivre", "MERCADO_LIVRE"]) {
      const result = validateRow({ SKU: "ABC1", Fonte: value }, 1, mapping, new Set());
      expect(result.source).toBe("mercado_livre");
      expect(result.isValid).toBe(true);
    }
  });

  it("rejeita priority não numérica", () => {
    const result = validateRow(
      { SKU: "ABC1", Fonte: "shopee", Prioridade: "alta" },
      1,
      mapping,
      new Set()
    );
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain("Prioridade inválida");
  });

  it("priority ausente/vazia não é erro — priorityOverride fica nulo", () => {
    const result = validateRow({ SKU: "ABC1", Fonte: "shopee", Prioridade: "" }, 1, mapping, new Set());
    expect(result.isValid).toBe(true);
    expect(result.priorityOverride).toBeNull();
  });

  it("priority numérica válida vira priorityOverride", () => {
    const result = validateRow({ SKU: "ABC1", Fonte: "shopee", Prioridade: "99" }, 1, mapping, new Set());
    expect(result.priorityOverride).toBe(99);
  });

  it("rejeita duplicata de (source, external_ref) dentro do mesmo lote", () => {
    const seen = new Set(["mercado_livre::ABC1"]);
    const result = validateRow({ SKU: "ABC1", Fonte: "mercado_livre" }, 2, mapping, seen);
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain("duplicado");
  });
});
