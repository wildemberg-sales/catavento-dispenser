import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { FileParseError, UnsupportedFileTypeError } from "../../lib/errors.js";

export type ParsedFile = {
  sourceType: "csv" | "xlsx";
  headers: string[];
  rows: Record<string, string>[];
};

function detectSourceType(filename: string): "csv" | "xlsx" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  throw new UnsupportedFileTypeError();
}

function parseCsv(buffer: Buffer): ParsedFile {
  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    throw new FileParseError(err instanceof Error ? err.message : "CSV inválido.");
  }
  const headers = records.length > 0 ? Object.keys(records[0]!) : [];
  return { sourceType: "csv", headers, rows: records };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs
    // resolve seu próprio tipo `Buffer` via um @types/node duplicado no
    // monorepo, estruturalmente incompatível com o Buffer global aqui.
    await workbook.xlsx.load(buffer as any);
  } catch (err) {
    throw new FileParseError(err instanceof Error ? err.message : "XLSX inválido.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new FileParseError("Nenhuma planilha encontrada no arquivo.");
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      record[header] = cell.value == null ? "" : String(cell.value).trim();
    });
    rows.push(record);
  }

  return { sourceType: "xlsx", headers, rows };
}

export async function parseFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const sourceType = detectSourceType(filename);
  return sourceType === "csv" ? parseCsv(buffer) : parseXlsx(buffer);
}
