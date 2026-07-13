import { describe, expect, it } from "vitest";
import {
  columnMappingSchema,
  confirmImportInputSchema,
  importPreviewResponseSchema,
  listImportRowsQuerySchema,
} from "../src/imports/schemas.js";

describe("imports schemas", () => {
  it("columnMappingSchema rejeita objeto sem externalRef", () => {
    const result = columnMappingSchema.safeParse({ source: "Fonte", payloadFields: [] });
    expect(result.success).toBe(false);
  });

  it("columnMappingSchema aceita mapeamento sem priority (opcional)", () => {
    const result = columnMappingSchema.safeParse({
      externalRef: "SKU",
      source: "Fonte",
      payloadFields: ["Nome"],
    });
    expect(result.success).toBe(true);
  });

  it("confirmImportInputSchema exige columnMapping válido", () => {
    const result = confirmImportInputSchema.safeParse({
      columnMapping: { externalRef: "SKU", source: "Fonte", payloadFields: [] },
    });
    expect(result.success).toBe(true);
    expect(confirmImportInputSchema.safeParse({}).success).toBe(false);
  });

  it("importPreviewResponseSchema valida a forma completa do preview", () => {
    const preview = {
      batchId: "3f5a1e2a-0000-4000-8000-000000000000",
      filename: "lote.csv",
      sourceType: "csv",
      suggestedMapping: { externalRef: "SKU", source: "Fonte", payloadFields: ["Nome"] },
      availableColumns: ["SKU", "Fonte", "Nome"],
      totalRows: 10,
      validRows: 8,
      rejectedRows: 2,
      sampleRows: [
        { rowNumber: 1, externalRef: "ABC", source: "mercado_livre", isValid: true, rejectionReason: null },
      ],
    };
    expect(importPreviewResponseSchema.safeParse(preview).success).toBe(true);
  });

  it("listImportRowsQuerySchema aceita status opcional e aplica defaults de paginação", () => {
    const result = listImportRowsQuerySchema.safeParse({ status: "invalid" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
    expect(listImportRowsQuerySchema.safeParse({ status: "algo" }).success).toBe(false);
  });
});
