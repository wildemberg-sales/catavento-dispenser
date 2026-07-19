import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { PriorityRule, QueueItemDTO, SourceType } from "@catavento/contracts/queue";
import { useAuth } from "../../auth/AuthContext";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

const STATUS_OPTIONS = ["pending", "in_progress", "completed", "cancelled", "problem"] as const;
const SOURCES: SourceType[] = ["mercado_livre", "shopee", "ebay"];

export function QueueManagementScreen() {
  const { apiClient } = useAuth();
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);

  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<QueueItemDTO[]>([]);
  const [rules, setRules] = useState<PriorityRule[]>(SOURCES.map((source) => ({ source, priority: 0, isActive: true })));
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const params: { status?: (typeof STATUS_OPTIONS)[number] } = {};
    if (status) params.status = status as (typeof STATUS_OPTIONS)[number];
    adminQueueApi.list(params).then((result) => setItems(result.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminQueueApi, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRequeue(id: string) {
    await adminQueueApi.requeue(id);
    refresh();
  }

  async function handleCancel(id: string) {
    await adminQueueApi.cancel(id);
    refresh();
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
      </Card>

      <Card className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Fonte</th>
              <th>Status</th>
              <th>Produto</th>
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
  filterCard: { padding: 16, maxWidth: 240 },
  filterLabel: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  small: { ...typography.small, color: colors.textMuted, margin: 0 },
  strong: { fontWeight: 600, color: colors.text },
  muted: { color: colors.textMuted },
  actionsCell: { display: "flex", gap: 8, flexWrap: "wrap" },
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
