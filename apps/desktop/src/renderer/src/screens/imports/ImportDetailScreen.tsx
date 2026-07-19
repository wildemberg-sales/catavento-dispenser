import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ImportBatchDTO, ImportBatchRowDTO } from "@catavento/contracts/imports";
import type { UnlinkedItem } from "@catavento/contracts/products";
import { useAuth } from "../../auth/AuthContext";
import { createImportsApi } from "../../api/imports.api";
import { createAdminQueueApi } from "../../api/adminQueue.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export function ImportDetailScreen() {
  const { batchId } = useParams<{ batchId: string }>();
  const { apiClient } = useAuth();
  const importsApi = useMemo(() => createImportsApi(apiClient), [apiClient]);
  const adminQueueApi = useMemo(() => createAdminQueueApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [batch, setBatch] = useState<ImportBatchDTO | null>(null);
  const [rows, setRows] = useState<ImportBatchRowDTO[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedItem[]>([]);
  const [unlinkedTotal, setUnlinkedTotal] = useState(0);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    importsApi.get(batchId).then(setBatch);
  }, [batchId, importsApi]);

  useEffect(() => {
    if (!batchId || !batch || batch.status !== "ready") return;
    importsApi.rows(batchId).then((result) => setRows(result.items));
    importsApi.unlinked(batchId).then((result) => {
      setUnlinked(result.items);
      setUnlinkedTotal(result.total);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, batch?.status]);

  async function handleLinkBySku() {
    if (!batchId) return;
    const result = await importsApi.linkBySku(batchId);
    setLinkResult(`${result.linkedCount} de ${result.totalItems} itens vinculados automaticamente.`);
    const refreshed = await importsApi.unlinked(batchId);
    setUnlinked(refreshed.items);
    setUnlinkedTotal(refreshed.total);
  }

  async function handleManualLink(itemId: string, productId: string) {
    await adminQueueApi.link(itemId, { productId });
    setUnlinked((current) => current.filter((item) => item.id !== itemId));
    setUnlinkedTotal((current) => Math.max(0, current - 1));
  }

  function handleRegisterProduct(item: UnlinkedItem) {
    const name = (item.payload.nome as string | undefined) ?? (item.payload.name as string | undefined) ?? item.externalRef;
    navigate("/products/new", {
      state: {
        prefillName: name,
        prefillSku: { source: item.source, sku: item.externalRef },
        fromQueueItemId: item.id,
      },
    });
  }

  if (!batch) return null;

  if (batch.status === "processing") {
    return (
      <div style={styles.container}>
        <PageHeader title={batch.filename} />
        <Card style={styles.pendingCard}>
          <span style={styles.pendingIcon}>⏳</span>
          <p style={styles.body}>
            Mapeamento pendente — os dados de pré-visualização foram perdidos. Refaça a importação para continuar.
          </p>
          <Button onClick={() => navigate("/imports/new")}>Nova importação</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title={batch.filename}
        subtitle={`${batch.validItems} válidos / ${batch.totalItems} total (${batch.rejectedItems} rejeitados)`}
        action={
          <Button data-testid="link-by-sku-button" variant="secondary" onClick={handleLinkBySku}>
            🔗 Vincular por SKU
          </Button>
        }
      />
      {linkResult ? (
        <p style={styles.successNote}>
          <span aria-hidden="true">✓ </span>
          <span>{linkResult}</span>
        </p>
      ) : null}

      {unlinkedTotal > 0 ? (
        <Card style={styles.reconciliationBanner}>
          <p style={styles.body}>
            {unlinkedTotal === 1
              ? "1 item não pôde ser vinculado automaticamente."
              : `${unlinkedTotal} itens não puderam ser vinculados automaticamente.`}
          </p>
          <button
            data-testid="go-to-reconciliation"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/reconciliation")}
          >
            Ver todos os itens sem vínculo
          </button>
        </Card>
      ) : null}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Linhas importadas</h2>
        <Card className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Linha</th>
                <th>Referência externa</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td style={styles.muted}>{row.rowNumber}</td>
                  <td style={styles.strong}>{row.externalRef}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Itens sem vínculo</h2>
        {unlinked.length === 0 ? (
          <Card style={styles.emptyLinked}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <p style={styles.body}>Todos os itens estão vinculados a um produto.</p>
          </Card>
        ) : (
          <div style={styles.unlinkedList}>
            {unlinked.map((item) => (
              <Card key={item.id} style={styles.unlinkedCard}>
                <p style={styles.unlinkedTitle}>
                  {(item.payload.nome as string | undefined) ?? item.externalRef}
                </p>
                <div style={styles.suggestionRow}>
                  {item.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.productId}
                      data-testid={`link-suggestion-${suggestion.productId}`}
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleManualLink(item.id, suggestion.productId)}
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
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  reconciliationBanner: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    backgroundColor: colors.warningSoft,
  },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionTitle: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  body: { ...typography.body, color: colors.text, margin: 0 },
  muted: { color: colors.textMuted },
  strong: { fontWeight: 600, color: colors.text },
  successNote: {
    ...typography.label,
    color: colors.success,
    backgroundColor: colors.successSoft,
    padding: "8px 14px",
    borderRadius: 10,
    margin: 0,
    alignSelf: "flex-start",
  },
  pendingCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    padding: "40px 24px",
  },
  pendingIcon: { fontSize: 32 },
  emptyLinked: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  unlinkedList: { display: "flex", flexDirection: "column", gap: 10 },
  unlinkedCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 16,
  },
  unlinkedTitle: { ...typography.label, color: colors.text, margin: 0 },
  suggestionRow: { display: "flex", flexWrap: "wrap", gap: 8 },
};
