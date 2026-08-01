import type {
  QueueItemDTO,
  AdminQueueQuery,
  UpdatePriorityRulesInput,
  PriorityRulesResponse,
  ProblemQueueItem,
} from "@catavento/contracts/queue";
import type { LinkQueueItemInput } from "@catavento/contracts/products";
import type { PaginationQuery, Paginated } from "@catavento/contracts/common";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

export function createAdminQueueApi(client: ApiClient) {
  return {
    list(params: Partial<AdminQueueQuery> = {}): Promise<Paginated<QueueItemDTO>> {
      return client.request(`/admin/queue/${buildQueryString(params)}`);
    },

    requeue(id: string): Promise<{ ok: true }> {
      return client.request(`/admin/queue/items/${id}/requeue`, { method: "POST" });
    },

    cancel(id: string): Promise<{ ok: true }> {
      return client.request(`/admin/queue/items/${id}/cancel`, { method: "POST" });
    },

    link(id: string, input: LinkQueueItemInput): Promise<{ ok: true }> {
      return client.request(`/admin/queue/items/${id}/link`, { method: "POST", body: input });
    },

    getPriorityRules(): Promise<PriorityRulesResponse> {
      return client.request("/admin/queue/rules");
    },

    problems(params: Partial<PaginationQuery> = {}): Promise<Paginated<ProblemQueueItem>> {
      return client.request(`/admin/queue/problems${buildQueryString(params)}`);
    },

    setPriorityRules(input: UpdatePriorityRulesInput): Promise<PriorityRulesResponse> {
      return client.request("/admin/queue/rules", { method: "PUT", body: input });
    },
  };
}

export type AdminQueueApi = ReturnType<typeof createAdminQueueApi>;
