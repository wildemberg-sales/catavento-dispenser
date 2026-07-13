import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workLogOutcomeEnum } from "./enums.js";
import { queueItems } from "./queue-items.js";
import { users } from "./users.js";

export const workLogs = pgTable(
  "work_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueItemId: uuid("queue_item_id")
      .notNull()
      .references(() => queueItems.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    outcome: workLogOutcomeEnum("outcome"),
    problemNote: text("problem_note"),
  },
  (table) => [
    index("work_logs_operator_started_idx").on(table.operatorId, table.startedAt),
    index("work_logs_queue_item_idx").on(table.queueItemId),
    // Throughput (Fase 6) agrupa/filtra por completed_at sem operator_id como
    // filtro — o índice composto acima (que começa por operator_id) não ajuda.
    index("work_logs_completed_at_idx").on(table.completedAt),
    // Um queue_item só pode ter um work_log ativo por vez; um operador só pode
    // ter um item in_progress por vez (Seção 4). Defesa de banco além do que
    // SKIP LOCKED já garante na transação de dequeue.
    uniqueIndex("work_logs_one_active_per_item")
      .on(table.queueItemId)
      .where(sql`completed_at IS NULL`),
    uniqueIndex("work_logs_one_active_per_operator")
      .on(table.operatorId)
      .where(sql`completed_at IS NULL`),
  ]
);
