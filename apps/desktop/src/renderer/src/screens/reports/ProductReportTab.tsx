import React from "react";
import type { ProductAnalyticsRow } from "@catavento/contracts/analytics";
import { Card } from "../../components/Card";
import { PaginationBar } from "../../components/PaginationBar";
import { colors } from "../../theme/colors";

type ProductReportTabProps = {
  rows: ProductAnalyticsRow[] | null;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function ProductReportTab({ rows, page, total, pageSize, onPageChange }: ProductReportTabProps) {
  return (
    <Card className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Concluídos</th>
            <th>Duração média (s)</th>
            <th>Desvio padrão (s)</th>
            <th>Operadores distintos</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row) => (
            <tr key={row.productId}>
              <td style={styles.strong}>{row.productName}</td>
              <td>{row.completedCount}</td>
              <td>{row.avgDurationSeconds ?? "-"}</td>
              <td>{row.stddevDurationSeconds ?? "-"}</td>
              <td>{row.distinctOperators}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        onChange={onPageChange}
        testIdPrefix="product-page"
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
