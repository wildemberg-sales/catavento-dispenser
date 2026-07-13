import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { importBatches } from "./import-batches.js";
import { importBatchRows } from "./import-batch-rows.js";
import { products } from "./products.js";
import { productSkus } from "./product-skus.js";
import { productImages } from "./product-images.js";
import { queueItems } from "./queue-items.js";
import { workLogs } from "./work-logs.js";
import { refreshTokens } from "./refresh-tokens.js";

export const usersRelations = relations(users, ({ many }) => ({
  workLogs: many(workLogs),
  refreshTokens: many(refreshTokens),
  importBatches: many(importBatches),
  products: many(products),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  importedByUser: one(users, {
    fields: [importBatches.importedBy],
    references: [users.id],
  }),
  queueItems: many(queueItems),
  rows: many(importBatchRows),
}));

export const importBatchRowsRelations = relations(importBatchRows, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importBatchRows.batchId],
    references: [importBatches.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  skus: many(productSkus),
  images: many(productImages),
  queueItems: many(queueItems),
}));

export const productSkusRelations = relations(productSkus, ({ one }) => ({
  product: one(products, {
    fields: [productSkus.productId],
    references: [products.id],
  }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const queueItemsRelations = relations(queueItems, ({ one, many }) => ({
  batch: one(importBatches, {
    fields: [queueItems.batchId],
    references: [importBatches.id],
  }),
  product: one(products, {
    fields: [queueItems.productId],
    references: [products.id],
  }),
  workLogs: many(workLogs),
}));

export const workLogsRelations = relations(workLogs, ({ one }) => ({
  queueItem: one(queueItems, {
    fields: [workLogs.queueItemId],
    references: [queueItems.id],
  }),
  operator: one(users, {
    fields: [workLogs.operatorId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
