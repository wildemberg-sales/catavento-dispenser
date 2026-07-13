import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sourceTypeEnum } from "./enums.js";
import { products } from "./products.js";

// Um produto pode ter um SKU diferente por marketplace (Mercado Livre, Shopee,
// eBay). A unicidade é por (source, sku), não por sku isolado, porque dois
// marketplaces podem coincidentemente usar o mesmo literal de SKU para
// produtos diferentes.
export const productSkus = pgTable(
  "product_skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    source: sourceTypeEnum("source").notNull(),
    sku: text("sku").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_skus_source_sku_unique").on(table.source, table.sku),
    index("product_skus_product_id_idx").on(table.productId),
    // Defesa em profundidade: um produto não pode ter mais de um SKU para a
    // mesma fonte (já validado no Zod, mas reforçado no banco).
    uniqueIndex("product_skus_product_source_unique").on(table.productId, table.source),
  ]
);
