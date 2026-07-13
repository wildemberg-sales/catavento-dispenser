import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sourceTypeEnum } from "./enums.js";
import { importBatches } from "./import-batches.js";

// Staging: guarda cada linha do arquivo importado, já no preview (antes da
// confirmação). "Sem persistir ainda" (Seção 6.2) significa não afetar a fila
// de produção (nenhum queue_item criado) até a confirmação — não significa
// que nada é gravado. Ver plano da Fase 4 para a justificativa completa.
export const importBatchRows = pgTable(
  "import_batch_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawData: jsonb("raw_data").notNull(),
    externalRef: text("external_ref"),
    source: sourceTypeEnum("source"),
    priority: integer("priority"),
    payload: jsonb("payload"),
    isValid: boolean("is_valid").notNull().default(true),
    rejectionReason: text("rejection_reason"),
  },
  (table) => [index("import_batch_rows_batch_id_idx").on(table.batchId)]
);
