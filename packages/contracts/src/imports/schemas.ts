import { z } from "zod";
import { paginationQuerySchema } from "../common/pagination.js";

export const importSourceTypeSchema = z.enum(["csv", "xlsx"]);
export type ImportSourceType = z.infer<typeof importSourceTypeSchema>;

export const importStatusSchema = z.enum(["processing", "ready", "failed"]);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const columnMappingSchema = z.object({
  externalRef: z.string().min(1),
  source: z.string().min(1),
  priority: z.string().optional(),
  payloadFields: z.array(z.string()),
});
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const importRowPreviewSchema = z.object({
  rowNumber: z.number().int(),
  externalRef: z.string().nullable(),
  source: z.string().nullable(),
  isValid: z.boolean(),
  rejectionReason: z.string().nullable(),
});
export type ImportRowPreview = z.infer<typeof importRowPreviewSchema>;

export const importPreviewResponseSchema = z.object({
  batchId: z.string().uuid(),
  filename: z.string(),
  sourceType: importSourceTypeSchema,
  suggestedMapping: columnMappingSchema,
  availableColumns: z.array(z.string()),
  totalRows: z.number().int(),
  validRows: z.number().int(),
  rejectedRows: z.number().int(),
  sampleRows: z.array(importRowPreviewSchema),
});
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;

export const confirmImportInputSchema = z.object({
  columnMapping: columnMappingSchema,
});
export type ConfirmImportInput = z.infer<typeof confirmImportInputSchema>;

export const importBatchDtoSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  sourceType: importSourceTypeSchema,
  status: importStatusSchema,
  totalItems: z.number().int(),
  validItems: z.number().int(),
  rejectedItems: z.number().int(),
  createdAt: z.string().datetime(),
});
export type ImportBatchDTO = z.infer<typeof importBatchDtoSchema>;

export const importBatchRowDtoSchema = importRowPreviewSchema.extend({
  payload: z.record(z.string(), z.unknown()).nullable(),
});
export type ImportBatchRowDTO = z.infer<typeof importBatchRowDtoSchema>;

export const listImportRowsQuerySchema = z
  .object({
    status: z.enum(["valid", "invalid"]).optional(),
  })
  .merge(paginationQuerySchema);
export type ListImportRowsQuery = z.infer<typeof listImportRowsQuerySchema>;
