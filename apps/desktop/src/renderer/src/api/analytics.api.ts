import type {
  AnalyticsPeriodQuery,
  OperatorAnalyticsRow,
  ProductAnalyticsRow,
  ThroughputQuery,
  ThroughputPoint,
  OperatorReport,
  ExportQuery,
} from "@catavento/contracts/analytics";
import type { PaginationQuery } from "@catavento/contracts/common";
import type { ApiClient } from "./client";
import { buildQueryString } from "./queryString";

type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export function createAnalyticsApi(client: ApiClient) {
  return {
    byOperator(params: AnalyticsPeriodQuery & Partial<PaginationQuery>): Promise<Paginated<OperatorAnalyticsRow>> {
      return client.request(`/admin/analytics/by-operator${buildQueryString(params)}`);
    },

    byProduct(params: AnalyticsPeriodQuery & Partial<PaginationQuery>): Promise<Paginated<ProductAnalyticsRow>> {
      return client.request(`/admin/analytics/by-product${buildQueryString(params)}`);
    },

    throughput(params: ThroughputQuery): Promise<{ items: ThroughputPoint[] }> {
      return client.request(`/admin/analytics/throughput${buildQueryString(params)}`);
    },

    operatorReport(operatorId: string, params: AnalyticsPeriodQuery): Promise<OperatorReport> {
      return client.request(`/admin/reports/operator/${operatorId}${buildQueryString(params)}`);
    },

    export(params: ExportQuery): Promise<Blob> {
      return client.requestBlob(`/admin/analytics/export${buildQueryString(params)}`);
    },
  };
}

export type AnalyticsApi = ReturnType<typeof createAnalyticsApi>;
