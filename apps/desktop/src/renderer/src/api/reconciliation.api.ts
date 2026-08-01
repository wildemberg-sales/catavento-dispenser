import type { UnlinkedItem } from "@catavento/contracts/products";
import type { Paginated } from "@catavento/contracts/common";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

export function createReconciliationApi(client: ApiClient) {
  return {
    list(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<UnlinkedItem>> {
      return client.request(`/admin/queue/unlinked${buildQueryString(params)}`);
    },
  };
}

export type ReconciliationApi = ReturnType<typeof createReconciliationApi>;
