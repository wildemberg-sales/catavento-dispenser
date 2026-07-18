import { z } from "zod";
import { sourceTypeSchema } from "../queue/schemas.js";
import { paginationQuerySchema } from "../common/pagination.js";

export const productSkuInputSchema = z.object({
  source: sourceTypeSchema,
  sku: z.string().min(1).max(200),
});
export type ProductSkuInput = z.infer<typeof productSkuInputSchema>;

export const productSkuDtoSchema = z.object({
  id: z.string().uuid(),
  source: sourceTypeSchema,
  sku: z.string(),
});
export type ProductSkuDTO = z.infer<typeof productSkuDtoSchema>;

export const productImageDtoSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  position: z.number().int(),
});
export type ProductImageDTO = z.infer<typeof productImageDtoSchema>;

export const productAttributesSchema = z.record(z.string(), z.unknown());

export const assemblyItemsSchema = z.array(z.string().min(1).max(300)).max(50);

function noDuplicateSkuSources(skus: ProductSkuInput[]): boolean {
  const sources = skus.map((s) => s.source);
  return new Set(sources).size === sources.length;
}

export const createProductInputSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  attributes: productAttributesSchema.default({}),
  assemblyItems: assemblyItemsSchema.default([]),
  skus: z.array(productSkuInputSchema).default([]).refine(noDuplicateSkuSources, {
    message: "Um produto não pode ter mais de um SKU para a mesma fonte.",
  }),
});
export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  attributes: productAttributesSchema.optional(),
  assemblyItems: assemblyItemsSchema.optional(),
  isActive: z.boolean().optional(),
  skus: z.array(productSkuInputSchema).refine(noDuplicateSkuSources, {
    message: "Um produto não pode ter mais de um SKU para a mesma fonte.",
  }).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

export const productDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  assemblyItems: z.array(z.string()),
  isActive: z.boolean(),
  skus: z.array(productSkuDtoSchema),
  images: z.array(productImageDtoSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductDTO = z.infer<typeof productDtoSchema>;

export const listProductsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(200).optional(),
    includeInactive: z.coerce.boolean().default(false),
  })
  .merge(paginationQuerySchema);
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const linkImportResultSchema = z.object({
  linkedCount: z.number().int(),
  totalItems: z.number().int(),
});
export type LinkImportResult = z.infer<typeof linkImportResultSchema>;

export const unlinkedItemSuggestionSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  score: z.number(),
});
export type UnlinkedItemSuggestion = z.infer<typeof unlinkedItemSuggestionSchema>;

export const unlinkedItemSchema = z.object({
  id: z.string().uuid(),
  externalRef: z.string(),
  source: sourceTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  suggestions: z.array(unlinkedItemSuggestionSchema),
});
export type UnlinkedItem = z.infer<typeof unlinkedItemSchema>;

export const linkQueueItemInputSchema = z.object({
  productId: z.string().uuid(),
});
export type LinkQueueItemInput = z.infer<typeof linkQueueItemInputSchema>;
