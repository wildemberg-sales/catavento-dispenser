import type { ExportQuery } from "@catavento/contracts/analytics";
import type { AnalyticsService } from "./analytics.service.js";
import { toCsv } from "../../lib/csv-writer.js";
import { buildXlsxWorkbook } from "./xlsx-builder.js";
import { MissingOperatorIdError } from "../../lib/errors.js";

const EXPORT_PAGE_SIZE = 10000;

type ExportColumn = { key: string; header: string };

const COLUMNS: Record<ExportQuery["report"], ExportColumn[]> = {
  "by-operator": [
    { key: "displayName", header: "Operador" },
    { key: "completedCount", header: "Concluídos" },
    { key: "abandonedCount", header: "Abandonados" },
    { key: "problemCount", header: "Com problema" },
    { key: "inProgressCount", header: "Em andamento" },
    { key: "avgDurationSeconds", header: "Duração média (s)" },
    { key: "completionRate", header: "Taxa de conclusão" },
    { key: "weightedRelativeSpeedScore", header: "Índice comparativo" },
  ],
  "by-product": [
    { key: "productName", header: "Produto" },
    { key: "completedCount", header: "Concluídos" },
    { key: "avgDurationSeconds", header: "Duração média (s)" },
    { key: "stddevDurationSeconds", header: "Desvio padrão (s)" },
    { key: "distinctOperators", header: "Operadores distintos" },
  ],
  throughput: [
    { key: "bucket", header: "Período" },
    { key: "completedCount", header: "Concluídos" },
  ],
  "operator-report": [
    { key: "productName", header: "Produto" },
    { key: "completedCount", header: "Concluídos" },
    { key: "avgDurationSeconds", header: "Duração média (s)" },
    { key: "teamAvgDurationSeconds", header: "Duração média da equipe (s)" },
    { key: "relativeSpeedIndex", header: "Índice relativo" },
  ],
};

export function exportService(deps: { service: AnalyticsService }) {
  const { service } = deps;

  async function fetchRows(query: ExportQuery): Promise<Record<string, unknown>[]> {
    switch (query.report) {
      case "by-operator": {
        const result = await service.getByOperator(query.from, query.to, { page: 1, pageSize: EXPORT_PAGE_SIZE });
        return result.items;
      }
      case "by-product": {
        const result = await service.getByProduct(query.from, query.to, { page: 1, pageSize: EXPORT_PAGE_SIZE });
        return result.items;
      }
      case "throughput": {
        return service.getThroughput(query.from, query.to, "day");
      }
      case "operator-report": {
        if (!query.operatorId) throw new MissingOperatorIdError();
        const report = await service.getOperatorReport(query.operatorId, query.from, query.to);
        return report.byProduct;
      }
    }
  }

  return {
    async export(query: ExportQuery): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
      const rows = await fetchRows(query);
      const columns = COLUMNS[query.report];

      if (query.format === "csv") {
        const csv = toCsv(rows, columns);
        return {
          buffer: Buffer.from(csv, "utf-8"),
          contentType: "text/csv; charset=utf-8",
          filename: `${query.report}.csv`,
        };
      }

      const buffer = await buildXlsxWorkbook(rows, columns, query.report);
      return {
        buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${query.report}.xlsx`,
      };
    },
  };
}

export type ExportService = ReturnType<typeof exportService>;
