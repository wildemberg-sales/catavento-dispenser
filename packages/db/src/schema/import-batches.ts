import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { importSourceTypeEnum, importStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  sourceType: importSourceTypeEnum("source_type").notNull(),
  importedBy: uuid("imported_by").references(() => users.id),
  columnMapping: jsonb("column_mapping").notNull().default({}),
  totalItems: integer("total_items").notNull().default(0),
  validItems: integer("valid_items").notNull().default(0),
  rejectedItems: integer("rejected_items").notNull().default(0),
  status: importStatusEnum("status").notNull().default("processing"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
