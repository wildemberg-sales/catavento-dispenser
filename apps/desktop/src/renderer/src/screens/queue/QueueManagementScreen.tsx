import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PriorityRule, QueueItemDTO, SourceType } from "@catavento/contracts/queue";
import { useAuth } from "../../auth/AuthContext";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { DateTimeCell } from "../../components/DateTimeCell";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { startOfDayIso, endOfDayIso } from "../../utils/dateRange";

const STATUS_OPTIONS = ["pending", "in_progress", "completed", "cancelled", "problem"] as const;
const SOURCES: SourceType[] = ["mercado_livre", "shopee", "ebay"];
// Sempre busca o máximo de itens por página permitido pela API — o objetivo
// é minimizar o número de idas ao servidor, não paginar cedo.
const PAGE_SIZE = 100;
// Espera essa pausa depois da última mudança de filtro antes de buscar —
// evita uma requisição por tecla digitada, mantendo a busca "ao vivo" (sem
// precisar de um botão) mas sem martelar o servidor a cada caractere.
const FILTER_DEBOUNCE_MS = 400;

export function QueueManagementScreen() {
  const { apiClient } = useAuth();
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);

  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  // Data única — vazia significa "todas as datas". Filtra o dia inteiro
  // (00:00:00 a 23:59:59) via from/to, sem expor período pro usuário.
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QueueItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [rules, setRules] = useState<PriorityRule[]>(SOURCES.map((source) => ({ source, priority: 0, isActive: true })));
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchPage(targetPage: number) {
    const params: {
      status?: (typeof STATUS_OPTIONS)[number];
      source?: SourceType;
      from?: string;
      to?: string;
      q?: string;
      page: number;
      pageSize: number;
    } = { page: targetPage, pageSize: PAGE_SIZE };
    if (status) params.status = status as (typeof STATUS_OPTIONS)[number];
    if (source) params.source = source as SourceType;
    if (date) {
      params.from = startOfDayIso(date);
      params.to = endOfDayIso(date);
    }
    if (query) params.q = query;
    adminQueueApi.list(params).then((result) => {
      setItems(result.items);
      setTotal(result.total);
    });
  }

  // Roda a primeira busca sem atraso; qualquer mudança de filtro depois disso
  // passa pelo debounce. Paginação (Anterior/Próxima) não passa por aqui —
  // dispara fetchPage diretamente, sem esperar.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPage(1);
      return;
    }
    const timeout = setTimeout(() => {
      setPage(1);
      fetchPage(1);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source, date, query]);

  function goToPage(targetPage: number) {
    setPage(targetPage);
    fetchPage(targetPage);
  }

  async function handleRequeue(id: string) {
    await adminQueueApi.requeue(id);
    fetchPage(page);
  }

  async function handleCancel(id: string) {
    await adminQueueApi.cancel(id);
    fetchPage(page);
  }

  function updateRule(source: SourceType, patch: Partial<PriorityRule>) {
    setRules((current) => current.map((rule) => (rule.source === source ? { ...rule, ...patch } : rule)));
  }

  async function handleSaveRules() {
    setRulesMessage(null);
    await adminQueueApi.setPriorityRules({ rules });
    setRulesMessage("Regras de prioridade atualizadas.");
  }

  return (
    <div style={styles.container}>
      <PageHeader title="Fila de produção" subtitle="Acompanhe e gerencie os pedidos em andamento" />

      <Card style={styles.filterCard}>
        <div style={styles.filterForm}>
          <label style={styles.filterLabelWide}>
            Buscar produto
            <input
              data-testid="search-filter"
              className="field"
              type="text"
              placeholder="Nome do produto, ex.: bolo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label style={styles.filterLabel}>
            Status
            <select
              data-testid="status-filter"
              className="field"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.filterLabel}>
            Fonte
            <select
              data-testid="source-filter"
              className="field"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Todas</option>
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.filterLabel}>
            Data (em branco = todas)
            <input
              data-testid="date-filter"
              className="field"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Fonte</th>
              <th>Status</th>
              <th>Produto</th>
              <th>Data de cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.strong}>{item.externalRef}</td>
                <td>{item.source}</td>
                <td data-testid={`status-${item.id}`}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={styles.muted}>{item.product?.name ?? "-"}</td>
                <td data-testid={`product-created-at-${item.id}`}>
                  {item.product ? <DateTimeCell value={item.product.createdAt} /> : <span style={styles.muted}>-</span>}
                </td>
                <td>
                  <div style={styles.actionsCell}>
                    {item.status === "cancelled" || item.status === "problem" ? (
                      <button
                        data-testid={`requeue-${item.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRequeue(item.id)}
                      >
                        Repor na fila
                      </button>
                    ) : null}
                    {item.status !== "completed" ? (
                      <button
                        data-testid={`cancel-${item.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleCancel(item.id)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={styles.paginationRow}>
        <Button
          data-testid="page-prev"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          Anterior
        </Button>
        <span style={styles.pageInfo}>
          Página {page} de {totalPages}
        </span>
        <Button
          data-testid="page-next"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          Próxima
        </Button>
      </div>

      <Card style={styles.rulesSection}>
        <h2 style={styles.sectionTitle}>🎯 Regras de prioridade</h2>
        <p style={styles.small}>
          Defina a prioridade de cada fonte (maior valor é atendido primeiro). Não é possível consultar as regras
          atualmente salvas — apenas sobrescrevê-las.
        </p>
        <div style={styles.rulesGrid}>
          {rules.map((rule) => (
            <div key={rule.source} style={styles.ruleRow}>
              <span style={styles.ruleSource}>{rule.source}</span>
              <input
                data-testid={`priority-${rule.source}`}
                className="field"
                style={styles.priorityInput}
                type="number"
                value={rule.priority}
                onChange={(event) => updateRule(rule.source, { priority: Number(event.target.value) })}
              />
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={(event) => updateRule(rule.source, { isActive: event.target.checked })}
                />
                Ativa
              </label>
            </div>
          ))}
        </div>
        <Button data-testid="priority-save" onClick={handleSaveRules} style={{ alignSelf: "flex-start" }}>
          Salvar regras
        </Button>
        {rulesMessage ? (
          <p style={styles.successNote}>
            <span aria-hidden="true">✓ </span>
            <span>{rulesMessage}</span>
          </p>
        ) : null}
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  filterCard: { padding: 16 },
  filterForm: { display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" },
  filterLabel: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  filterLabelWide: {
    ...typography.label,
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 220,
  },
  small: { ...typography.small, color: colors.textMuted, margin: 0 },
  strong: { fontWeight: 600, color: colors.text },
  muted: { color: colors.textMuted },
  actionsCell: { display: "flex", gap: 8, flexWrap: "wrap" },
  paginationRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
  pageInfo: { ...typography.label, color: colors.textMuted },
  rulesSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 24,
    maxWidth: 520,
  },
  rulesGrid: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  ruleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 4px",
    borderBottom: `1px solid ${colors.border}`,
  },
  ruleSource: { ...typography.body, color: colors.text, width: 120, fontWeight: 600 },
  priorityInput: { width: 80 },
  checkboxLabel: {
    ...typography.body,
    color: colors.textMuted,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  successNote: {
    ...typography.label,
    color: colors.success,
    backgroundColor: colors.successSoft,
    padding: "8px 14px",
    borderRadius: 10,
    margin: 0,
    alignSelf: "flex-start",
  },
};
