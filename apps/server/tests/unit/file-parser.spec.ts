import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseFile } from "../../src/modules/imports/file-parser.js";

describe("parseFile", () => {
  it("parseia um CSV simples com header e linhas", async () => {
    const csv = "SKU,Fonte,Nome\nABC1,mercado_livre,Produto A\nABC2,shopee,Produto B\n";
    const result = await parseFile(Buffer.from(csv, "utf-8"), "lote.csv");
    expect(result.sourceType).toBe("csv");
    expect(result.headers).toEqual(["SKU", "Fonte", "Nome"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ SKU: "ABC1", Fonte: "mercado_livre", Nome: "Produto A" });
  });

  it("ignora o BOM UTF-8 no primeiro header do CSV", async () => {
    const csv = "﻿SKU,Fonte\nABC1,shopee\n";
    const result = await parseFile(Buffer.from(csv, "utf-8"), "lote.csv");
    expect(result.headers[0]).toBe("SKU");
  });

  it("parseia um XLSX simples com a mesma forma normalizada que o CSV", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Produtos");
    sheet.addRow(["SKU", "Fonte", "Nome"]);
    sheet.addRow(["ABC1", "mercado_livre", "Produto A"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseFile(buffer, "lote.xlsx");
    expect(result.sourceType).toBe("xlsx");
    expect(result.headers).toEqual(["SKU", "Fonte", "Nome"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ SKU: "ABC1", Fonte: "mercado_livre", Nome: "Produto A" });
  });

  it("usa apenas a primeira planilha quando o XLSX tem múltiplas abas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet("Primeira");
    sheet1.addRow(["SKU"]);
    sheet1.addRow(["ABC1"]);
    const sheet2 = workbook.addWorksheet("Segunda");
    sheet2.addRow(["Outro"]);
    sheet2.addRow(["XYZ"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseFile(buffer, "lote.xlsx");
    expect(result.headers).toEqual(["SKU"]);
    expect(result.rows).toHaveLength(1);
  });

  it("lança FileParseError para extensão não suportada", async () => {
    await expect(parseFile(Buffer.from("conteudo qualquer"), "arquivo.txt")).rejects.toThrow();
  });

  it("lança FileParseError para XLSX corrompido", async () => {
    await expect(parseFile(Buffer.from("nao e um xlsx valido"), "lote.xlsx")).rejects.toThrow();
  });
});
