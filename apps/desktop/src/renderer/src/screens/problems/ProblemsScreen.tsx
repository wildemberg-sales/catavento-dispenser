import React, { useMemo, useState } from "react";
import type { ProblemQueueItem } from "@catavento/contracts/queue";
import { useAuth } from "../../auth/AuthContext";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

// Sempre busca o máximo de itens por página permitido pela API — mesmo
// padrão de QueueManagementScreen ("buscar o máximo, paginar só se precisar").
const PAGE_SIZE = 100;

// Fallback de nome pra item sem produto vinculado — mesmo payload cru usado
// em QueueManagementScreen/ReconciliationScreen (a chave varia conforme o
// header da planilha de origem: 'nome' ou 'name').
function itemDisplayName(item: ProblemQueueItem): string {
  return item.productName ?? (item.payload.nome as string | undefined) ?? (item.payload.name as string | undefined) ?? item.externalRef;
}

export function ProblemsScreen() {
  const { apiClient } = useAuth();
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);

  const [items, setItems] = useState<ProblemQueueItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchPage(targetPage: number) {
    adminQueueApi
      .problems({ page: targetPage, pageSize: PAGE_SIZE })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => setError("Não foi possível carregar os itens com problema."));
  }

  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToPage(targetPage: number) {
    setPage(targetPage);
    fetchPage(targetPage);
  }

  // Resolver um item (repor na fila pra tentar de novo, ou cancelar de vez)
  // é o que torna essa tela uma ferramenta de análise caso a caso — reaproveita
  // os mesmos endpoints já usados pela Fila de produção, sem duplicar lógica.
  async function handleResolve(itemId: string, action: "requeue" | "cancel") {
    setError(null);
    try {
      if (action === "requeue") {
        await adminQueueApi.requeue(itemId);
      } else {
        await adminQueueApi.cancel(itemId);
      }
      fetchPage(page);
    } catch {
      setError("Não foi possível atualizar o item.");
    }
  }

  return (
    <div style={styles.container}>
      <PageHeader title="Problemas" subtitle="Itens reportados com problema pelos operadores, pra análise caso a caso" />

      {error ? <p style={styles.error}>{error}</p> : null}

      {items !== null && items.length === 0 ? (
        <Card style={styles.emptyState}>
          <span style={styles.emptyIcon}>🎉</span>
          <p style={styles.emptyText}>Nenhum item com problema no momento.</p>
        </Card>
      ) : (
        <div style={styles.list}>
          {(items ?? []).map((item) => (
            <Card key={item.id} style={styles.problemCard}>
              <div style={styles.problemHeader}>
                <p style={styles.problemName}>{itemDisplayName(item)}</p>
                <span style={styles.problemMeta}>
                  <span>{item.externalRef}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{item.source}</span>
                  <span aria-hidden="true"> · </span>
                  <span>reportado por {item.operatorDisplayName}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{new Date(item.reportedAt).toLocaleString()}</span>
                </span>
              </div>
              <p style={styles.problemNote}>{item.problemNote ?? "Sem observação registrada."}</p>
              <div style={styles.actionsRow}>
                <button
                  data-testid={`problem-requeue-${item.id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleResolve(item.id, "requeue")}
                >
                  Repor na fila
                </button>
                <button
                  data-testid={`problem-cancel-${item.id}`}
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleResolve(item.id, "cancel")}
                >
                  Cancelar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div style={styles.paginationRow}>
          <Button data-testid="page-prev" variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
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
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  problemCard: { padding: 16, display: "flex", flexDirection: "column", gap: 8 },
  problemHeader: { display: "flex", flexDirection: "column", gap: 2 },
  problemName: { ...typography.label, color: colors.text, margin: 0, fontWeight: 600 },
  problemMeta: { ...typography.small, color: colors.textMuted },
  problemNote: { ...typography.body, color: colors.danger, margin: 0, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 8 },
  actionsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  emptyState: { padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyText: { ...typography.body, color: colors.textMuted, margin: 0 },
  paginationRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
  pageInfo: { ...typography.label, color: colors.textMuted },
};
