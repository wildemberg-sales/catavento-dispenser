import type {
  ImportPreviewResponse,
  ImportBatchDTO,
  ImportBatchRowDTO,
  ConfirmImportInput,
} from "@catavento/contracts/imports";
import type { UnlinkedItem, LinkImportResult } from "@catavento/contracts/products";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export function createImportsApi(client: ApiClient) {
  return {
    upload(file: File): Promise<ImportPreviewResponse> {
      const formData = new FormData();
      formData.append("file", file);
      return client.request<ImportPreviewResponse>("/admin/imports/", { method: "POST", body: formData });
    },

    list(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<ImportBatchDTO>> {
      return client.request(`/admin/imports/${buildQueryString(params)}`);
    },

    get(id: string): Promise<ImportBatchDTO> {
      return client.request(`/admin/imports/${id}`);
    },

    rows(
      id: string,
      params: { status?: "valid" | "invalid"; page?: number; pageSize?: number } = {}
    ): Promise<Paginated<ImportBatchRowDTO>> {
      return client.request(`/admin/imports/${id}/rows${buildQueryString(params)}`);
    },

    confirm(id: string, input: ConfirmImportInput): Promise<ImportBatchDTO> {
      return client.request(`/admin/imports/${id}/confirm`, { method: "POST", body: input });
    },

    linkBySku(id: string): Promise<LinkImportResult> {
      return client.request(`/admin/imports/${id}/link`, { method: "POST" });
    },

    unlinked(id: string, params: { page?: number; pageSize?: number } = {}): Promise<Paginated<UnlinkedItem>> {
      return client.request(`/admin/imports/${id}/unlinked${buildQueryString(params)}`);
    },
  };
}

export type ImportsApi = ReturnType<typeof createImportsApi>;
