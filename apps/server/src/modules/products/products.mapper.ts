import type { ProductDTO } from "@catavento/contracts/products";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  attributes: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SkuRow = { id: string; source: "mercado_livre" | "shopee" | "ebay"; sku: string };
type ImageRow = { id: string; url: string; position: number };

export function toProductDto(product: ProductRow, skus: SkuRow[], images: ImageRow[]): ProductDTO {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    attributes: product.attributes as Record<string, unknown>,
    isActive: product.isActive,
    skus: skus.map((s) => ({ id: s.id, source: s.source, sku: s.sku })),
    images: images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ id: img.id, url: img.url, position: img.position })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
