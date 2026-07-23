import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { OperatorAnalyticsRow, OperatorReport, ProductAnalyticsRow, ThroughputPoint } from "@catavento/contracts/analytics";
import { useAuth } from "../../auth/AuthContext";
import { createAnalyticsApi } from "../../api/analytics.api";
import { createUsersApi } from "../../api/users.api";
import { ApiClientError } from "../../api/client";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { TrendChart } from "../../components/charts/TrendChart";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { startOfDayIso, endOfDayIso } from "../../utils/dateRange";

const TABS = [
  { key: "by-operator", label: "Por operador" },
  { key: "by-product", label: "Por produto" },
  { key: "throughput", label: "Throughput" },
  { key: "operator-report", label: "Relatório individual" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function defaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

export function ReportsScreen() {
  const { apiClient } = useAuth();
  const analyticsApi = useMemo(() => createAnalyticsApi(apiClient), [apiClient]);
  const usersApi = useMemo(() => createUsersApi(apiClient), [apiClient]);

  const initialRange = useMemo(defaultDateRange, []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [activeTab, setActiveTab] = useState<TabKey>("by-operator");
  const [bucket, setBucket] = useState<"hour" | "day">("day");

  const [operatorRows, setOperatorRows] = useState<OperatorAnalyticsRow[] | null>(null);
  const [productRows, setProductRows] = useState<ProductAnalyticsRow[] | null>(null);
  const [throughputPoints, setThroughputPoints] = useState<ThroughputPoint[] | null>(null);
  const [operators, setOperators] = useState<{ id: string; displayName: string }[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [operatorReport, setOperatorReport] = useState<OperatorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    usersApi
      .list({ role: "operator" })
      .then((result) => setOperators(result.items))
      .catch(() => {
        // A seleção de operador na aba de relatório individual fica vazia;
        // não vale a pena travar a tela inteira por causa disso.
      });
  }, [usersApi]);

  const refresh = useCallback(() => {
    setError(null);
    const period = { from: startOfDayIso(fromDate), to: endOfDayIso(toDate) };
    const handleError = (err: unknown) =>
      setError(err instanceof ApiClientError ? err.message : "Não foi possível carregar o relatório.");

    if (activeTab === "by-operator") {
      analyticsApi.byOperator(period).then((result) => setOperatorRows(result.items)).catch(handleError);
    } else if (activeTab === "by-product") {
      analyticsApi.byProduct(period).then((result) => setProductRows(result.items)).catch(handleError);
    } else if (activeTab === "throughput") {
      analyticsApi.throughput({ ...period, bucket }).then((result) => setThroughputPoints(result.items)).catch(handleError);
    } else if (activeTab === "operator-report" && selectedOperatorId) {
      analyticsApi.operatorReport(selectedOperatorId, period).then(setOperatorReport).catch(handleError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsApi, activeTab, fromDate, toDate, bucket, selectedOperatorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(true);
    try {
      const period = { from: startOfDayIso(fromDate), to: endOfDayIso(toDate) };
      const params: { format: "csv" | "xlsx"; report: TabKey; from: string; to: string; operatorId?: string } = {
        format,
        report: activeTab,
        ...period,
      };
      if (activeTab === "operator-report" && selectedOperatorId) params.operatorId = selectedOperatorId;

      const blob = await analyticsApi.export(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeTab}.${format}`;
      // O link precisa estar no DOM pro clique disparar o download de forma
      // confiável no Chromium/Electron; revogar a blob URL só depois de um
      // tick evita cortar o download antes dele começar a ler o blob.
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível exportar o relatório.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={styles.container}>
      <PageHeader title="Relatórios" subtitle="Produtividade, qualidade e throughput da produção" />

      <Card style={styles.filterCard}>
        <label style={styles.filterLabel}>
          De
          <input
            data-testid="date-from"
            className="field"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label style={styles.filterLabel}>
          Até
          <input
            data-testid="date-to"
            className="field"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
      </Card>

      <div style={styles.tabRow}>
        <div style={styles.tabButtons}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              className={`btn btn-sm ${activeTab === tab.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={styles.exportButtons}>
          <Button
            data-testid="export-csv"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => handleExport("csv")}
          >
            Exportar CSV
          </Button>
          <Button
            data-testid="export-xlsx"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => handleExport("xlsx")}
          >
            Exportar XLSX
          </Button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {activeTab === "by-operator" ? (
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
              {(operatorRows ?? []).map((row) => (
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
        </Card>
      ) : null}

      {activeTab === "by-product" ? (
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
              {(productRows ?? []).map((row) => (
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
        </Card>
      ) : null}

      {activeTab === "throughput" ? (
        <Card style={styles.throughputCard}>
          <div style={styles.bucketRow}>
            <button
              data-testid="bucket-day"
              className={`btn btn-sm ${bucket === "day" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setBucket("day")}
            >
              Por dia
            </button>
            <button
              data-testid="bucket-hour"
              className={`btn btn-sm ${bucket === "hour" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setBucket("hour")}
            >
              Por hora
            </button>
          </div>
          <TrendChart data={throughputPoints ?? []} xKey="bucket" yKey="completedCount" variant="bar" dateTimeAxis />
        </Card>
      ) : null}

      {activeTab === "operator-report" ? (
        <div style={styles.operatorReportSection}>
          <Card style={styles.filterCard}>
            <label style={styles.filterLabel}>
              Operador
              <select
                data-testid="operator-select"
                className="field"
                value={selectedOperatorId}
                onChange={(event) => setSelectedOperatorId(event.target.value)}
              >
                <option value="">Selecione…</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.displayName}
                  </option>
                ))}
              </select>
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
                  <span style={styles.statLabel}>Índice de pontualidade</span>
                  <span style={styles.statValue}>{operatorReport.overview.punctuality.punctualityIndex ?? "-"}</span>
                </Card>
                <Card style={styles.statCard}>
                  <span style={styles.statLabel}>Posição no ranking</span>
                  <span style={styles.statValue}>
                    {`${operatorReport.ranking.positionAmongOperators ?? "-"} de ${operatorReport.ranking.totalOperatorsRanked}`}
                  </span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {operatorReport.byProduct.map((row) => (
                      <tr key={row.productId}>
                        <td style={styles.strong}>{row.productName}</td>
                        <td>{row.completedCount}</td>
                        <td>{row.avgDurationSeconds ?? "-"}</td>
                        <td>{row.teamAvgDurationSeconds ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card style={styles.throughputCard}>
                <h2 style={styles.sectionTitle}>Série temporal</h2>
                <TrendChart data={operatorReport.timeSeries} xKey="date" yKey="completedCount" variant="line" dateTimeAxis />
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  filterCard: { padding: 16, display: "flex", flexWrap: "wrap", gap: 20 },
  filterLabel: {
    ...typography.label,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  tabRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tabButtons: { display: "flex", flexWrap: "wrap", gap: 8 },
  exportButtons: { display: "flex", flexWrap: "wrap", gap: 8 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
  strong: { fontWeight: 600, color: colors.text },
  throughputCard: { padding: 20, display: "flex", flexDirection: "column", gap: 14 },
  bucketRow: { display: "flex", gap: 8 },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  operatorReportSection: { display: "flex", flexDirection: "column", gap: 20 },
  statsRow: { display: "flex", flexWrap: "wrap", gap: 16 },
  statCard: { padding: 16, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 },
  statLabel: { ...typography.label, color: colors.textMuted },
  statValue: { ...typography.sectionTitle, color: colors.secondary },
};
