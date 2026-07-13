import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "operator"]);

// Fonte do pedido (marketplace de origem) — não confundir com o formato do
// arquivo importado (import_source_type_enum, abaixo).
export const sourceTypeEnum = pgEnum("source_type", ["mercado_livre", "shopee", "ebay"]);

export const importSourceTypeEnum = pgEnum("import_source_type", ["csv", "xlsx"]);
export const importStatusEnum = pgEnum("import_status", ["processing", "ready", "failed"]);

export const queueItemStatusEnum = pgEnum("queue_item_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "problem",
]);

export const workLogOutcomeEnum = pgEnum("work_log_outcome", [
  "completed",
  "abandoned",
  "problem",
  "cancelled",
]);
