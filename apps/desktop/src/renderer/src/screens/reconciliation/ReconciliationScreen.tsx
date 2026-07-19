import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UnlinkedItem } from "@catavento/contracts/products";
import { useAuth } from "../../auth/AuthContext";
import { createReconciliationApi } from "../../api/reconciliation.api";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

function displayName(item: UnlinkedItem): string {
  return (item.payload.nome as string | undefined) ?? (item.payload.name as string | undefined) ?? item.externalRef;
}

export function ReconciliationScreen() {
  const { apiClient } = useAuth();
  const reconciliationApi = useMemo(() => createReconciliationApi(apiClient), [apiClient]);
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [items, setItems] = useState<UnlinkedItem[] | null>(null);

  const refresh = useCallback(() => {
    reconciliationApi.list().then((result) => setItems(result.items));
  }, [reconciliationApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleLinkSuggestion(item: UnlinkedItem, productId: string) {
    await adminQueueApi.link(item.id, { productId });
    refresh();
  }

  function handleRegisterProduct(item: UnlinkedItem) {
    navigate("/products/new", {
      state: {
        prefillName: displayName(item),
        prefillSku: { source: item.source, sku: item.externalRef },
        fromQueueItemId: item.id,
      },
    });
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title="Itens sem vínculo"
        subtitle="Pedidos de qualquer importação que ainda não têm um produto vinculado"
      />

      {items === null ? null : items.length === 0 ? (
        <Card style={styles.emptyState}>
          <span style={styles.emptyIcon}>🎉</span>
          <p style={styles.emptyText}>Todos os itens estão vinculados a um produto.</p>
        </Card>
      ) : (
        <div style={styles.list}>
          {items.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <div style={styles.itemHeader}>
                <p style={styles.itemName}>{displayName(item)}</p>
                <span style={styles.itemMeta}>
                  <span>{item.externalRef}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{item.source}</span>
                </span>
              </div>
              <div style={styles.actionsRow}>
                {item.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.productId}
                    data-testid={`link-suggestion-${item.id}-${suggestion.productId}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleLinkSuggestion(item, suggestion.productId)}
                  >
                    Vincular a {suggestion.productName} ({Math.round(suggestion.score * 100)}%)
                  </button>
                ))}
                <button
                  data-testid={`register-product-${item.id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRegisterProduct(item)}
                >
                  Cadastrar produto
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  itemCard: { display: "flex", flexDirection: "column", gap: 10, padding: 16 },
  itemHeader: { display: "flex", flexDirection: "column", gap: 2 },
  itemName: { ...typography.label, color: colors.text, margin: 0 },
  itemMeta: { ...typography.small, color: colors.textMuted },
  actionsRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  emptyState: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  emptyIcon: { fontSize: 20 },
  emptyText: { ...typography.body, color: colors.text, margin: 0 },
};
