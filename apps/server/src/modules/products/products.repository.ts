import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import type { ProductSkuInput } from "@catavento/contracts/products";

export function productsRepository(db: DbInstance) {
  return {
    async insertProduct(data: {
      name: string;
      description?: string | undefined;
      attributes: Record<string, unknown>;
      createdBy?: string | undefined;
    }) {
      const [product] = await db.insert(schema.products).values(data).returning();
      return product!;
    },

    async insertSkus(productId: string, skus: ProductSkuInput[]) {
      if (skus.length === 0) return;
      await db.insert(schema.productSkus).values(skus.map((s) => ({ productId, ...s })));
    },

    async replaceSkus(productId: string, skus: ProductSkuInput[]) {
      await db.delete(schema.productSkus).where(eq(schema.productSkus.productId, productId));
      if (skus.length > 0) {
        await db.insert(schema.productSkus).values(skus.map((s) => ({ productId, ...s })));
      }
    },

    async findById(id: string) {
      const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
      return product ?? null;
    },

    async findByIdWithRelations(id: string) {
      const product = await this.findById(id);
      if (!product) return null;
      const [skus, images] = await Promise.all([
        db.select().from(schema.productSkus).where(eq(schema.productSkus.productId, id)),
        db
          .select()
          .from(schema.productImages)
          .where(eq(schema.productImages.productId, id))
          .orderBy(asc(schema.productImages.position)),
      ]);
      return { product, skus, images };
    },

    async updateProduct(
      id: string,
      patch: Partial<{
        name: string | undefined;
        description: string | undefined;
        attributes: Record<string, unknown> | undefined;
        isActive: boolean | undefined;
      }>
    ) {
      await db.update(schema.products).set({ ...patch, updatedAt: new Date() }).where(eq(schema.products.id, id));
    },

    async softDelete(id: string) {
      await db.update(schema.products).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.products.id, id));
    },

    async search(
      filters: { search?: string | undefined; includeInactive: boolean },
      pagination: { page: number; pageSize: number }
    ) {
      const conditions = [];
      if (!filters.includeInactive) conditions.push(eq(schema.products.isActive, true));
      if (filters.search) {
        conditions.push(
          or(
            ilike(schema.products.name, `%${filters.search}%`),
            sql`EXISTS (SELECT 1 FROM product_skus ps WHERE ps.product_id = ${schema.products.id} AND ps.sku ILIKE ${`%${filters.search}%`})`
          )
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(schema.products)
          .where(where)
          .orderBy(asc(schema.products.name))
          .limit(pagination.pageSize)
          .offset(offset),
        db.select({ total: count() }).from(schema.products).where(where),
      ]);

      const ids = items.map((p) => p.id);
      const [skusByProduct, imagesByProduct] = await Promise.all([
        ids.length > 0
          ? db.select().from(schema.productSkus).where(inArray(schema.productSkus.productId, ids))
          : Promise.resolve([]),
        ids.length > 0
          ? db.select().from(schema.productImages).where(inArray(schema.productImages.productId, ids))
          : Promise.resolve([]),
      ]);

      return {
        items,
        skusByProduct,
        imagesByProduct,
        total: Number(totalRows[0]!.total),
      };
    },

    async insertImage(data: { productId: string; storageKey: string; url: string; position: number }) {
      const [image] = await db.insert(schema.productImages).values(data).returning();
      return image!;
    },

    async countImages(productId: string) {
      const [row] = await db
        .select({ total: count() })
        .from(schema.productImages)
        .where(eq(schema.productImages.productId, productId));
      return Number(row!.total);
    },

    async findImageById(imageId: string) {
      const [image] = await db.select().from(schema.productImages).where(eq(schema.productImages.id, imageId));
      return image ?? null;
    },

    async deleteImage(imageId: string) {
      await db.delete(schema.productImages).where(eq(schema.productImages.id, imageId));
    },
  };
}

export type ProductsRepository = ReturnType<typeof productsRepository>;
