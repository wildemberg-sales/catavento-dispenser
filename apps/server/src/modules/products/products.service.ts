import type { CreateProductInput, ListProductsQuery, ProductDTO, UpdateProductInput } from "@catavento/contracts/products";
import type { ProductsRepository } from "./products.repository.js";
import { toProductDto } from "./products.mapper.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { DuplicateSkuError, ProductNotFoundError } from "../../lib/errors.js";

export function productsService(deps: { repo: ProductsRepository }) {
  const { repo } = deps;

  return {
    async createProduct(input: CreateProductInput, createdBy: string): Promise<ProductDTO> {
      const product = await repo.insertProduct({
        name: input.name,
        description: input.description,
        attributes: input.attributes,
        createdBy,
      });

      try {
        await repo.insertSkus(product.id, input.skus);
      } catch (err) {
        if (isUniqueViolation(err)) throw new DuplicateSkuError();
        throw err;
      }

      const withRelations = await repo.findByIdWithRelations(product.id);
      return toProductDto(withRelations!.product, withRelations!.skus, withRelations!.images);
    },

    async getProduct(id: string): Promise<ProductDTO> {
      const result = await repo.findByIdWithRelations(id);
      if (!result) throw new ProductNotFoundError();
      return toProductDto(result.product, result.skus, result.images);
    },

    async updateProduct(id: string, input: UpdateProductInput): Promise<ProductDTO> {
      const existing = await repo.findById(id);
      if (!existing) throw new ProductNotFoundError();

      await repo.updateProduct(id, {
        name: input.name,
        description: input.description,
        attributes: input.attributes,
        isActive: input.isActive,
      });

      if (input.skus !== undefined) {
        try {
          await repo.replaceSkus(id, input.skus);
        } catch (err) {
          if (isUniqueViolation(err)) throw new DuplicateSkuError();
          throw err;
        }
      }

      const result = await repo.findByIdWithRelations(id);
      return toProductDto(result!.product, result!.skus, result!.images);
    },

    async deleteProduct(id: string): Promise<void> {
      const existing = await repo.findById(id);
      if (!existing) throw new ProductNotFoundError();
      await repo.softDelete(id);
    },

    async listProducts(query: ListProductsQuery) {
      const { search, includeInactive, page, pageSize } = query;
      const { items, skusByProduct, imagesByProduct, total } = await repo.search(
        { search, includeInactive },
        { page, pageSize }
      );

      return {
        items: items.map((product) =>
          toProductDto(
            product,
            skusByProduct.filter((s) => s.productId === product.id),
            imagesByProduct.filter((img) => img.productId === product.id)
          )
        ),
        total,
        page,
        pageSize,
      };
    },
  };
}

export type ProductsService = ReturnType<typeof productsService>;
