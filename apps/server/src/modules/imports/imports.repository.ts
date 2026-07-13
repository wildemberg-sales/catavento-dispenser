import { and, asc, count, eq, sql } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import type { ColumnMapping, ImportSourceType, ImportStatus } from "@catavento/contracts/imports";
import type { ValidatedRow } from "./row-validator.js";

export function importsRepository(db: DbInstance) {
  return {
    async insertBatch(data: {
      filename: string;
      sourceType: ImportSourceType;
      importedBy: string;
      columnMapping: ColumnMapping;
      totalItems: number;
      validItems: number;
      rejectedItems: number;
      status: ImportStatus;
    }) {
      const [batch] = await db.insert(schema.importBatches).values(data).returning();
      return batch!;
    },

    async insertRows(batchId: string, rawRows: Record<string, string>[], validated: ValidatedRow[]) {
      if (validated.length === 0) return;
      await db.insert(schema.importBatchRows).values(
        validated.map((row, index) => ({
          batchId,
          rowNumber: row.rowNumber,
          rawData: rawRows[index] ?? {},
          externalRef: row.externalRef,
          source: row.source,
          priority: row.priorityOverride,
          payload: row.payload,
          isValid: row.isValid,
          rejectionReason: row.rejectionReason,
        }))
      );
    },

    async findBatchById(id: string) {
      const [batch] = await db.select().from(schema.importBatches).where(eq(schema.importBatches.id, id));
      return batch ?? null;
    },

    async listBatches(pagination: { page: number; pageSize: number }) {
      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(schema.importBatches)
          .orderBy(asc(schema.importBatches.createdAt))
          .limit(pagination.pageSize)
          .offset(offset),
        db.select({ total: count() }).from(schema.importBatches),
      ]);
      return { items, total: Number(totalRows[0]!.total) };
    },

    async findRowsRawOrdered(batchId: string) {
      return db
        .select({
          id: schema.importBatchRows.id,
          rowNumber: schema.importBatchRows.rowNumber,
          rawData: schema.importBatchRows.rawData,
        })
        .from(schema.importBatchRows)
        .where(eq(schema.importBatchRows.batchId, batchId))
        .orderBy(asc(schema.importBatchRows.rowNumber));
    },

    async updateRowValidation(rowId: string, row: ValidatedRow) {
      await db
        .update(schema.importBatchRows)
        .set({
          externalRef: row.externalRef,
          source: row.source,
          priority: row.priorityOverride,
          payload: row.payload,
          isValid: row.isValid,
          rejectionReason: row.rejectionReason,
        })
        .where(eq(schema.importBatchRows.id, rowId));
    },

    async findRows(
      batchId: string,
      filters: { status?: "valid" | "invalid" | undefined },
      pagination: { page: number; pageSize: number }
    ) {
      const conditions = [eq(schema.importBatchRows.batchId, batchId)];
      if (filters.status === "valid") conditions.push(eq(schema.importBatchRows.isValid, true));
      if (filters.status === "invalid") conditions.push(eq(schema.importBatchRows.isValid, false));

      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(schema.importBatchRows)
          .where(and(...conditions))
          .orderBy(asc(schema.importBatchRows.rowNumber))
          .limit(pagination.pageSize)
          .offset(offset),
        db.select({ total: count() }).from(schema.importBatchRows).where(and(...conditions)),
      ]);
      return { items, total: Number(totalRows[0]!.total) };
    },

    async updateBatchAfterConfirm(
      batchId: string,
      data: {
        status: ImportStatus;
        columnMapping: ColumnMapping;
        totalItems: number;
        validItems: number;
        rejectedItems: number;
      }
    ) {
      await db.update(schema.importBatches).set(data).where(eq(schema.importBatches.id, batchId));
    },

    async insertQueueItemsForValidRows(
      batchId: string,
      rows: Array<{ externalRef: string; source: string; priority: number; payload: Record<string, unknown> }>
    ) {
      if (rows.length === 0) return;
      await db.insert(schema.queueItems).values(
        rows.map((row) => ({
          batchId,
          externalRef: row.externalRef,
          source: row.source as "mercado_livre" | "shopee" | "ebay",
          priority: row.priority,
          payload: row.payload,
        }))
      );
    },

    // Vinculação automática por SKU (Seção 6.7): um único UPDATE em lote,
    // casando por (source, external_ref) = (source, sku). A cláusula
    // `product_id IS NULL` torna a operação idempotente e nunca sobrescreve
    // um vínculo manual já feito.
    async linkBatchBySku(batchId: string): Promise<{ linkedCount: number; totalItems: number }> {
      return db.transaction(async (tx) => {
        const result = await tx.execute(sql`
          UPDATE queue_items qi
          SET product_id = ps.product_id, updated_at = now()
          FROM product_skus ps
          WHERE qi.batch_id = ${batchId}
            AND qi.source = ps.source
            AND qi.external_ref = ps.sku
            AND qi.product_id IS NULL
          RETURNING qi.id
        `);
        const [totalRow] = await tx
          .select({ total: count() })
          .from(schema.queueItems)
          .where(eq(schema.queueItems.batchId, batchId));
        return { linkedCount: result.rows.length, totalItems: Number(totalRow!.total) };
      });
    },

    async findUnlinkedWithSuggestions(
      batchId: string,
      pagination: { page: number; pageSize: number }
    ): Promise<{ items: Array<{ id: string; externalRef: string; source: string; payload: Record<string, unknown> }>; total: number }> {
      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select({
            id: schema.queueItems.id,
            externalRef: schema.queueItems.externalRef,
            source: schema.queueItems.source,
            payload: schema.queueItems.payload,
          })
          .from(schema.queueItems)
          .where(and(eq(schema.queueItems.batchId, batchId), sql`${schema.queueItems.productId} IS NULL`))
          .orderBy(asc(schema.queueItems.sequence))
          .limit(pagination.pageSize)
          .offset(offset),
        db
          .select({ total: count() })
          .from(schema.queueItems)
          .where(and(eq(schema.queueItems.batchId, batchId), sql`${schema.queueItems.productId} IS NULL`)),
      ]);
      return { items: items.map((i) => ({ ...i, payload: i.payload as Record<string, unknown> })), total: Number(totalRows[0]!.total) };
    },

    async findSuggestionsForItem(
      externalRef: string,
      payload: Record<string, unknown>
    ): Promise<Array<{ productId: string; productName: string; score: number }>> {
      const displayName =
        (payload.nome as string | undefined) ?? (payload.name as string | undefined) ?? externalRef;
      const result = await db.execute(sql`
        SELECT id, name, similarity(name, ${displayName}) AS score
        FROM products
        WHERE is_active = true AND similarity(name, ${displayName}) > 0.2
        ORDER BY score DESC
        LIMIT 3
      `);
      return result.rows.map((row) => ({
        productId: (row as Record<string, unknown>).id as string,
        productName: (row as Record<string, unknown>).name as string,
        score: Number((row as Record<string, unknown>).score),
      }));
    },
  };
}

export type ImportsRepository = ReturnType<typeof importsRepository>;
