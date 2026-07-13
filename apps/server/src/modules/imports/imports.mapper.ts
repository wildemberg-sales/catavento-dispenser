import type { ImportBatchDTO, ImportBatchRowDTO } from "@catavento/contracts/imports";

type BatchRow = {
  id: string;
  filename: string;
  sourceType: "csv" | "xlsx";
  status: "processing" | "ready" | "failed";
  totalItems: number;
  validItems: number;
  rejectedItems: number;
  createdAt: Date;
};

export function toImportBatchDto(row: BatchRow): ImportBatchDTO {
  return {
    id: row.id,
    filename: row.filename,
    sourceType: row.sourceType,
    status: row.status,
    totalItems: row.totalItems,
    validItems: row.validItems,
    rejectedItems: row.rejectedItems,
    createdAt: row.createdAt.toISOString(),
  };
}

type BatchRowRow = {
  rowNumber: number;
  externalRef: string | null;
  source: string | null;
  payload: Record<string, unknown> | null;
  isValid: boolean;
  rejectionReason: string | null;
};

export function toImportBatchRowDto(row: BatchRowRow): ImportBatchRowDTO {
  return {
    rowNumber: row.rowNumber,
    externalRef: row.externalRef,
    source: row.source,
    payload: row.payload,
    isValid: row.isValid,
    rejectionReason: row.rejectionReason,
  };
}
