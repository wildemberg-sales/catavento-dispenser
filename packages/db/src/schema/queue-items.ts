import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { queueItemStatusEnum, sourceTypeEnum } from "./enums.js";
import { importBatches } from "./import-batches.js";
import { products } from "./products.js";

export const queueItems = pgTable(
  "queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    externalRef: text("external_ref").notNull(),
    // Fonte do pedido (mercado_livre/shopee/ebay). Define a ordem de produção
    // padrão junto com `priority` — o mapeamento fonte->prioridade fica para a
    // Fase 4 (importação); aqui a coluna já existe e é preenchida.
    source: sourceTypeEnum("source").notNull(),
    productId: uuid("product_id").references(() => products.id),
    payload: jsonb("payload").notNull().default({}),
    priority: integer("priority").notNull().default(0),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    status: queueItemStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Itens sem product_id vinculado sempre saem por último no dequeue
    // (ver queue.repository.ts dequeueNext) — a expressão `(product_id IS
    // NULL)` precisa liderar a ordenação do índice pra continuar servindo
    // o ORDER BY sem sort adicional.
    index("queue_items_dequeue_idx").on(
      table.status,
      sql`(${table.productId} IS NULL)`,
      table.priority.desc(),
      table.sequence.asc()
    ),
    index("queue_items_product_id_idx").on(table.productId),
    index("queue_items_batch_id_idx").on(table.batchId),
  ]
);
