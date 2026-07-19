import type { UnlinkedItem } from "@catavento/contracts/products";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export function createReconciliationApi(client: ApiClient) {
  return {
    list(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<UnlinkedItem>> {
      return client.request(`/admin/queue/unlinked${buildQueryString(params)}`);
    },
  };
}

export type ReconciliationApi = ReturnType<typeof createReconciliationApi>;
