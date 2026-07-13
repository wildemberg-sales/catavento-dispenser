import { describe, expect, it } from "vitest";
import { suggestColumnMapping } from "../../src/modules/imports/column-mapper.js";

describe("suggestColumnMapping", () => {
  it("sugere externalRef, source e payloadFields a partir de aliases conhecidos", () => {
    const mapping = suggestColumnMapping(["SKU", "Fonte", "Nome"]);
    expect(mapping.externalRef).toBe("SKU");
    expect(mapping.source).toBe("Fonte");
    expect(mapping.payloadFields).toEqual(["Nome"]);
  });

  it("reconhece headers com acentos e maiúsculas variadas", () => {
    const mapping = suggestColumnMapping(["Código Produto", "ORIGEM", "Descrição"]);
    expect(mapping.externalRef).toBe("Código Produto");
    expect(mapping.source).toBe("ORIGEM");
    expect(mapping.payloadFields).toEqual(["Descrição"]);
  });

  it("sugere priority quando há uma coluna reconhecível", () => {
    const mapping = suggestColumnMapping(["SKU", "Fonte", "Prioridade", "Nome"]);
    expect(mapping.priority).toBe("Prioridade");
    expect(mapping.payloadFields).toEqual(["Nome"]);
  });

  it("retorna mapeamento vazio para externalRef/source quando não há alias reconhecível", () => {
    const mapping = suggestColumnMapping(["Col1", "Col2"]);
    expect(mapping.externalRef).toBe("");
    expect(mapping.source).toBe("");
    expect(mapping.payloadFields).toEqual(["Col1", "Col2"]);
  });
});
