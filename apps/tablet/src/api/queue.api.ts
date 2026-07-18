import type { NextItemResponse } from "@catavento/contracts/queue";
import type { ApiClient } from "./client";

export function createQueueApi(client: ApiClient) {
  return {
    next(): Promise<NextItemResponse> {
      return client.request<NextItemResponse>("/queue/next", { method: "POST" });
    },

    current(): Promise<NextItemResponse> {
      return client.request<NextItemResponse>("/queue/current", { method: "GET" });
    },

    complete(queueItemId: string): Promise<void> {
      return client.request<void>(`/queue/items/${queueItemId}/complete`, { method: "POST" });
    },

    problem(queueItemId: string, note: string): Promise<void> {
      return client.request<void>(`/queue/items/${queueItemId}/problem`, {
        method: "POST",
        body: { note },
      });
    },
  };
}

export type QueueApi = ReturnType<typeof createQueueApi>;
