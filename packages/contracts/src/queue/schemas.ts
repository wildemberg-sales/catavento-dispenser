import { z } from "zod";
import { paginationQuerySchema } from "../common/pagination.js";

export const queueItemStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "problem",
]);
export type QueueItemStatus = z.infer<typeof queueItemStatusSchema>;

// Fonte do pedido — também usada por product_skus para vincular um produto
// a SKUs diferentes por marketplace (Fase 5, fora de escopo aqui).
export const sourceTypeSchema = z.enum(["mercado_livre", "shopee", "ebay"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

// Dados herdados do produto do catálogo vinculado ao item (Seção 4.2) — nulo
// enquanto o item não tiver product_id, ou se a vinculação nunca ocorreu.
export const linkedProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  assemblyItems: z.array(z.string()),
  images: z.array(z.object({ url: z.string(), position: z.number().int() })),
  createdAt: z.string().datetime(),
});
export type LinkedProduct = z.infer<typeof linkedProductSchema>;

export const queueItemDtoSchema = z.object({
  id: z.string().uuid(),
  externalRef: z.string(),
  source: sourceTypeSchema,
  productId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number().int(),
  status: queueItemStatusSchema,
  createdAt: z.string().datetime(),
  product: linkedProductSchema.nullable(),
});
export type QueueItemDTO = z.infer<typeof queueItemDtoSchema>;

export const nextItemResponseSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(true), item: queueItemDtoSchema }),
  z.object({ available: z.literal(false) }).strict(),
]);
export type NextItemResponse = z.infer<typeof nextItemResponseSchema>;

export const problemItemInputSchema = z.object({
  note: z.string().min(1).max(1000),
});
export type ProblemItemInput = z.infer<typeof problemItemInputSchema>;

const ALL_SOURCES = ["mercado_livre", "shopee", "ebay"] as const;

export const priorityRuleSchema = z.object({
  source: sourceTypeSchema,
  priority: z.number().int(),
  isActive: z.boolean(),
});
export type PriorityRule = z.infer<typeof priorityRuleSchema>;

export const updatePriorityRulesInputSchema = z.object({
  rules: z
    .array(priorityRuleSchema)
    .length(3)
    .refine(
      (rules) =>
        new Set(rules.map((r) => r.source)).size === 3 &&
        ALL_SOURCES.every((s) => rules.some((r) => r.source === s)),
      { message: "Informe exatamente uma regra para cada fonte (mercado_livre, shopee, ebay), sem repetir." }
    ),
});
export type UpdatePriorityRulesInput = z.infer<typeof updatePriorityRulesInputSchema>;

export const priorityRulesResponseSchema = z.object({ rules: z.array(priorityRuleSchema) });
export type PriorityRulesResponse = z.infer<typeof priorityRulesResponseSchema>;

export const adminQueueQuerySchema = z
  .object({
    status: queueItemStatusSchema.optional(),
    batchId: z.string().uuid().optional(),
    source: sourceTypeSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    q: z.string().min(1).max(200).optional(),
  })
  .merge(paginationQuerySchema)
  .refine((v) => !v.from || !v.to || new Date(v.to) > new Date(v.from), {
    message: "'to' deve ser posterior a 'from'.",
  });
export type AdminQueueQuery = z.infer<typeof adminQueueQuerySchema>;
