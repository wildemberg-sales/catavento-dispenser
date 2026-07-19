import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ImportBatchDTO } from "@catavento/contracts/imports";
import { useAuth } from "../../auth/AuthContext";
import { createImportsApi } from "../../api/imports.api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export function ImportsListScreen() {
  const { apiClient } = useAuth();
  const importsApi = useMemo(() => createImportsApi(apiClient), [apiClient]);
  const navigate = useNavigate();
  const [batches, setBatches] = useState<ImportBatchDTO[] | null>(null);

  useEffect(() => {
    importsApi.list().then((result) => setBatches(result.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importsApi]);

  return (
    <div style={styles.container}>
      <PageHeader
        title="Importações"
        subtitle="Planilhas de pedidos recebidas dos marketplaces"
        action={
          <Button data-testid="new-import-button" onClick={() => navigate("/imports/new")}>
            + Nova importação
          </Button>
        }
      />

      {batches === null ? null : batches.length === 0 ? (
        <Card style={styles.emptyState}>
          <span style={styles.emptyIcon}>📭</span>
          <p style={styles.emptyText}>Nenhuma importação ainda.</p>
          <p style={styles.emptyHint}>Envie sua primeira planilha para começar a montar a fila de produção.</p>
        </Card>
      ) : (
        <Card className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Status</th>
                <th>Válidos / Total</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} style={styles.row} onClick={() => navigate(`/imports/${batch.id}`)}>
                  <td style={styles.filename}>{batch.filename}</td>
                  <td>
                    <StatusBadge status={batch.status} />
                  </td>
                  <td>
                    {batch.validItems} / {batch.totalItems}
                  </td>
                  <td style={styles.muted}>{new Date(batch.createdAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  row: { cursor: "pointer" },
  filename: { fontWeight: 600, color: colors.text },
  muted: { color: colors.textMuted },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 6,
    padding: "56px 24px",
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.sectionTitle, color: colors.secondary, margin: 0 },
  emptyHint: { ...typography.body, color: colors.textMuted, margin: 0 },
};
