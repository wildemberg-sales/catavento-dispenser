import { boolean, integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { sourceTypeEnum } from "./enums.js";

// Uma linha por fonte (não um motor de regras genérico — o requisito real é
// "admin pode reordenar/alterar a prioridade por fonte", Seção 11.5/11.6).
// Semeada via INSERT na migration (ver 0001_*.sql), sempre com as 3 fontes
// presentes — o motor de fila e a importação dependem disso.
export const queuePriorityRules = pgTable("queue_priority_rules", {
  source: sourceTypeEnum("source").primaryKey(),
  priority: integer("priority").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
