import type {
  ProductDTO,
  ProductImageDTO,
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from "@catavento/contracts/products";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export function createProductsApi(client: ApiClient) {
  return {
    list(params: Partial<ListProductsQuery> = {}): Promise<Paginated<ProductDTO>> {
      return client.request(`/admin/products/${buildQueryString(params)}`);
    },

    get(id: string): Promise<ProductDTO> {
      return client.request(`/admin/products/${id}`);
    },

    create(input: CreateProductInput): Promise<ProductDTO> {
      return client.request("/admin/products/", { method: "POST", body: input });
    },

    update(id: string, input: UpdateProductInput): Promise<ProductDTO> {
      return client.request(`/admin/products/${id}`, { method: "PUT", body: input });
    },

    deactivate(id: string): Promise<{ ok: true }> {
      return client.request(`/admin/products/${id}`, { method: "DELETE" });
    },

    reactivate(id: string): Promise<ProductDTO> {
      return client.request(`/admin/products/${id}`, { method: "PUT", body: { isActive: true } });
    },

    uploadImage(productId: string, file: File): Promise<ProductImageDTO> {
      const formData = new FormData();
      formData.append("file", file);
      return client.request(`/admin/products/${productId}/images`, { method: "POST", body: formData });
    },

    deleteImage(productId: string, imageId: string): Promise<{ ok: true }> {
      return client.request(`/admin/products/${productId}/images/${imageId}`, { method: "DELETE" });
    },
  };
}

export type ProductsApi = ReturnType<typeof createProductsApi>;
