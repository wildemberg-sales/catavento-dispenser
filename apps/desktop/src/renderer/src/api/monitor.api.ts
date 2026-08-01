import type { OnlineOperatorsResponse } from "@catavento/contracts/monitor";
import type { ApiClient } from "./client";

export function createMonitorApi(client: ApiClient) {
  return {
    getOnlineOperators(): Promise<OnlineOperatorsResponse> {
      return client.request("/admin/monitor/online-operators");
    },
  };
}

export type MonitorApi = ReturnType<typeof createMonitorApi>;
