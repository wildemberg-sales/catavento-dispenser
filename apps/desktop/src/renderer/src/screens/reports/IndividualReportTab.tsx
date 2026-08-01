import React from "react";
import type { OperatorReport, OperatorReportItem } from "@catavento/contracts/analytics";
import { Card } from "../../components/Card";
import { PaginationBar } from "../../components/PaginationBar";
import { TrendChart } from "../../components/charts/TrendChart";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const OUTCOME_LABELS: Record<string, string> = {
  completed: "Concluído",
  abandoned: "Abandonado",
  problem: "Problema",
};

type OperatorOption = { id: string; displayName: string };

type IndividualReportTabProps = {
  operatorQuery: string;
  onQueryChange: (value: string) => void;
  showSuggestions: boolean;
  filteredOperators: OperatorOption[];
  onFocus: () => void;
  onBlur: () => void;
  onSelectOperator: (operator: OperatorOption) => void;
  operatorReport: OperatorReport | null;
  reportItems: OperatorReportItem[] | null;
  reportItemsPage: number;
  reportItemsTotal: number;
  pageSize: number;
  onReportItemsPageChange: (page: number) => void;
};

export function IndividualReportTab({
  operatorQuery,
  onQueryChange,
  showSuggestions,
  filteredOperators,
  onFocus,
  onBlur,
  onSelectOperator,
  operatorReport,
  reportItems,
  reportItemsPage,
  reportItemsTotal,
  pageSize,
  onReportItemsPageChange,
}: IndividualReportTabProps) {
  return (
    <div style={styles.operatorReportSection}>
      <Card style={styles.filterCard}>
        <label style={styles.filterLabel}>
          Operador
          <div style={styles.comboboxWrapper}>
            <input
              data-testid="operator-search"
              className="field"
              type="text"
              placeholder="Buscar operador…"
              value={operatorQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            {showSuggestions && filteredOperators.length > 0 ? (
              <ul style={styles.suggestionList} data-testid="operator-suggestions">
                {filteredOperators.map((operator) => (
                  <li key={operator.id}>
                    <button
                      type="button"
                      data-testid={`operator-suggestion-${operator.id}`}
                      style={styles.suggestionItem}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectOperator(operator)}
                    >
                      {operator.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </label>
      </Card>

      {operatorReport ? (
        <>
          <div style={styles.statsRow}>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Itens por hora</span>
              <span style={styles.statValue}>{operatorReport.overview.productivity.itemsPerHour.toFixed(1)}</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Taxa de conclusão</span>
              <span style={styles.statValue}>{Math.round(operatorReport.overview.quality.completionRate * 100)}%</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Taxa de problemas</span>
              <span style={styles.statValue}>{Math.round(operatorReport.overview.quality.problemRate * 100)}%</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Taxa de abandono</span>
              <span style={styles.statValue}>{Math.round(operatorReport.overview.quality.abandonmentRate * 100)}%</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Índice de qualidade</span>
              <span style={styles.statValue}>{operatorReport.overview.quality.qualityIndex.toFixed(2)}</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Índice de pontualidade</span>
              <span style={styles.statValue}>{operatorReport.overview.punctuality.punctualityIndex ?? "-"}</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Intervalo médio entre itens (s)</span>
              <span style={styles.statValue}>{operatorReport.overview.punctuality.avgGapSeconds ?? "-"}</span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Variação de duração (CV)</span>
              <span style={styles.statValue}>
                {operatorReport.overview.punctuality.durationCoefficientOfVariation?.toFixed(2) ?? "-"}
              </span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Posição no ranking</span>
              <span style={styles.statValue}>
                {`${operatorReport.ranking.positionAmongOperators ?? "-"} de ${operatorReport.ranking.totalOperatorsRanked}`}
              </span>
            </Card>
            <Card style={styles.statCard}>
              <span style={styles.statLabel}>Velocidade relativa (ponderada)</span>
              <span style={styles.statValue}>{operatorReport.ranking.weightedRelativeSpeedScore?.toFixed(2) ?? "-"}</span>
            </Card>
          </div>

          <Card className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Concluídos</th>
                  <th>Duração média (s)</th>
                  <th>Média da equipe (s)</th>
                  <th>Índice de velocidade relativa</th>
                </tr>
              </thead>
              <tbody>
                {operatorReport.byProduct.map((row) => (
                  <tr key={row.productId}>
                    <td style={styles.strong}>{row.productName}</td>
                    <td>{row.completedCount}</td>
                    <td>{row.avgDurationSeconds ?? "-"}</td>
                    <td>{row.teamAvgDurationSeconds ?? "-"}</td>
                    <td>{row.relativeSpeedIndex?.toFixed(2) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card style={styles.throughputCard}>
            <h2 style={styles.sectionTitle}>Série temporal</h2>
            <TrendChart data={operatorReport.timeSeries} xKey="date" yKey="completedCount" variant="line" dateTimeAxis />
          </Card>

          <Card className="table-wrapper">
            <h2 style={styles.sectionTitle}>Itens do período</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Resultado</th>
                  <th>Início</th>
                  <th>Conclusão</th>
                  <th>Duração (s)</th>
                  <th>Observação do problema</th>
                </tr>
              </thead>
              <tbody>
                {(reportItems ?? []).map((item) => (
                  <tr key={item.workLogId}>
                    <td style={styles.strong}>{item.productName ?? "(sem produto)"}</td>
                    <td>{item.outcome ? (OUTCOME_LABELS[item.outcome] ?? item.outcome) : "Em andamento"}</td>
                    <td>{new Date(item.startedAt).toLocaleString()}</td>
                    <td>{item.completedAt ? new Date(item.completedAt).toLocaleString() : "-"}</td>
                    <td>{item.durationSeconds ?? "-"}</td>
                    <td>{item.problemNote ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={reportItemsPage}
              total={reportItemsTotal}
              pageSize={pageSize}
              onChange={onReportItemsPageChange}
              testIdPrefix="report-items-page"
              variant="ghost"
              showTotal
              hideWhenSinglePage
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filterCard: { padding: 16, display: "flex", flexWrap: "wrap", gap: 20 },
  filterLabel: {
    ...typography.label,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  operatorReportSection: { display: "flex", flexDirection: "column", gap: 20 },
  statsRow: { display: "flex", flexWrap: "wrap", gap: 16 },
  statCard: { padding: 16, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 },
  statLabel: { ...typography.label, color: colors.textMuted },
  statValue: { ...typography.sectionTitle, color: colors.secondary },
  comboboxWrapper: { position: "relative", minWidth: 260 },
  suggestionList: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    margin: 0,
    padding: 6,
    listStyle: "none",
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    boxShadow: `0 8px 24px ${colors.shadowStrong}`,
    zIndex: 10,
    maxHeight: 240,
    overflowY: "auto",
  },
  suggestionItem: {
    ...typography.body,
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    border: "none",
    background: "none",
    color: colors.text,
    cursor: "pointer",
    borderRadius: 6,
  },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  throughputCard: { padding: 20, display: "flex", flexDirection: "column", gap: 14 },
  strong: { fontWeight: 600, color: colors.text },
};
