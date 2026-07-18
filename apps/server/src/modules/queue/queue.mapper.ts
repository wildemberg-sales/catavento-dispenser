import type { LinkedProduct, QueueItemDTO } from "@catavento/contracts/queue";
import type { QueueItemRow } from "./queue.repository.js";

export type LinkedProductRow = {
  id: string;
  name: string;
  description: string | null;
  attributes: unknown;
  assemblyItems: unknown;
  images: Array<{ url: string; position: number }>;
};

export function toQueueItemDto(row: QueueItemRow, linkedProduct: LinkedProductRow | null = null): QueueItemDTO {
  const product: LinkedProduct | null = linkedProduct
    ? {
        id: linkedProduct.id,
        name: linkedProduct.name,
        description: linkedProduct.description,
        attributes: linkedProduct.attributes as Record<string, unknown>,
        assemblyItems: linkedProduct.assemblyItems as string[],
        images: linkedProduct.images
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((img) => ({ url: img.url, position: img.position })),
      }
    : null;

  return {
    id: row.id,
    externalRef: row.externalRef,
    source: row.source,
    productId: row.productId,
    payload: row.payload,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    product,
  };
}
