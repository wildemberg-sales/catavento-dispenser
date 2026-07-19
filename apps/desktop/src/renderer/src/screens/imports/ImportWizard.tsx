import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnMapping, ImportPreviewResponse } from "@catavento/contracts/imports";
import { useAuth } from "../../auth/AuthContext";
import { createImportsApi } from "../../api/imports.api";
import { ApiClientError } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";

export function ImportWizard() {
  const { apiClient } = useAuth();
  const importsApi = useMemo(() => createImportsApi(apiClient), [apiClient]);
  const navigate = useNavigate();

  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guarda contra o usuário navegar pra outra tela enquanto upload/confirm
  // ainda estão em voo: sem isso, um `navigate()` de uma chamada obsoleta
  // (ex.: confirm lento) dispara depois que o usuário já saiu daqui, e
  // arrasta ele de volta pra essa tela contra a vontade dele.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um arquivo CSV ou XLSX para continuar.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await importsApi.upload(file);
      if (!isMountedRef.current) return;
      setPreview(result);
      setMapping(result.suggestedMapping);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof ApiClientError ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!preview || !mapping) return;
    setError(null);
    setSubmitting(true);
    try {
      const batch = await importsApi.confirm(preview.batchId, { columnMapping: mapping });
      if (!isMountedRef.current) return;
      navigate(`/imports/${batch.id}`);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof ApiClientError ? err.message : "Não foi possível confirmar a importação.");
      setSubmitting(false);
    }
  }

  function updateMapping(field: keyof ColumnMapping, value: string) {
    if (!mapping) return;
    setMapping({ ...mapping, [field]: value || undefined });
  }

  if (!preview || !mapping) {
    return (
      <div style={styles.container}>
        <PageHeader title="Nova importação" subtitle="Envie uma planilha CSV ou XLSX com os pedidos" />
        <Card style={styles.formCard}>
          <form style={styles.form} onSubmit={handleUpload}>
            <div style={styles.dropzone}>
              <span style={styles.dropzoneIcon}>🧁</span>
              <input
                data-testid="upload-file-input"
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {file ? <p style={styles.fileName}>Selecionado: {file.name}</p> : null}
            </div>
            {error ? <p style={styles.error}>{error}</p> : null}
            <Button data-testid="upload-submit" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
              Enviar
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <PageHeader
        title="Mapeamento de colunas"
        subtitle={`${preview.filename} · ${preview.totalRows} linhas (${preview.validRows} válidas, ${preview.rejectedRows} rejeitadas)`}
      />

      <Card style={styles.formCard}>
        <div style={styles.mappingGrid}>
          <label style={styles.label}>
            Coluna do ID do pedido
            <select
              data-testid="mapping-external-ref"
              className="field"
              value={mapping.externalRef}
              onChange={(event) => updateMapping("externalRef", event.target.value)}
            >
              {preview.availableColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Coluna da fonte/marketplace
            <select
              data-testid="mapping-source"
              className="field"
              value={mapping.source}
              onChange={(event) => updateMapping("source", event.target.value)}
            >
              {preview.availableColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Coluna de prioridade (opcional)
            <select
              data-testid="mapping-priority"
              className="field"
              value={mapping.priority ?? ""}
              onChange={(event) => updateMapping("priority", event.target.value)}
            >
              <option value="">Nenhuma</option>
              {preview.availableColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Linha</th>
              <th>Referência externa</th>
              <th>Fonte</th>
              <th>Válida</th>
            </tr>
          </thead>
          <tbody>
            {preview.sampleRows.map((row) => (
              <tr key={row.rowNumber}>
                <td style={styles.muted}>{row.rowNumber}</td>
                <td style={styles.strong}>{row.externalRef}</td>
                <td>{row.source}</td>
                <td style={row.isValid ? styles.validText : styles.invalidText}>
                  {row.isValid ? "Sim" : row.rejectionReason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {error ? <p style={styles.error}>{error}</p> : null}
      <Button
        data-testid="mapping-confirm"
        onClick={handleConfirm}
        disabled={submitting}
        style={{ alignSelf: "flex-start" }}
      >
        Confirmar importação
      </Button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 20 },
  formCard: { padding: 24, maxWidth: 520 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "28px 16px",
    borderRadius: 14,
    border: `2px dashed ${colors.border}`,
    backgroundColor: colors.backgroundAlt,
  },
  dropzoneIcon: { fontSize: 28 },
  fileName: { ...typography.label, color: colors.secondary, margin: 0 },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  label: { ...typography.label, color: colors.text, display: "flex", flexDirection: "column", gap: 6 },
  error: { ...typography.label, color: colors.danger, margin: 0 },
  muted: { color: colors.textMuted },
  strong: { fontWeight: 600, color: colors.text },
  validText: { color: colors.success, fontWeight: 600 },
  invalidText: { color: colors.danger },
};
