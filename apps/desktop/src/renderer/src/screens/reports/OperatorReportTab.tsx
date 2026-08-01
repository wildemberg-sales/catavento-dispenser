import React from "react";
import type { OperatorAnalyticsRow } from "@catavento/contracts/analytics";
import { Card } from "../../components/Card";
import { PaginationBar } from "../../components/PaginationBar";
import { colors } from "../../theme/colors";

type OperatorReportTabProps = {
  rows: OperatorAnalyticsRow[] | null;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function OperatorReportTab({ rows, page, total, pageSize, onPageChange }: OperatorReportTabProps) {
  return (
    <Card className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Operador</th>
            <th>Concluídos</th>
            <th>Problemas</th>
            <th>Abandonados</th>
            <th>Em andamento</th>
            <th>Duração média (s)</th>
            <th>Taxa de conclusão</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row) => (
            <tr key={row.operatorId}>
              <td style={styles.strong}>{row.displayName}</td>
              <td>{row.completedCount}</td>
              <td>{row.problemCount}</td>
              <td>{row.abandonedCount}</td>
              <td>{row.inProgressCount}</td>
              <td>{row.avgDurationSeconds ?? "-"}</td>
              <td>{Math.round(row.completionRate * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        onChange={onPageChange}
        testIdPrefix="operator-page"
        variant="ghost"
        showTotal
        hideWhenSinglePage
      />
    </Card>
  );
}

const styles: Record<string, React.CSSProperties> = {
  strong: { fontWeight: 600, color: colors.text },
};
