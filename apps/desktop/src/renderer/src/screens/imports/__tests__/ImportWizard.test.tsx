import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ImportWizard } from "../ImportWizard";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const previewResponse = {
  batchId: "batch-1",
  filename: "pedidos.csv",
  sourceType: "csv",
  suggestedMapping: {
    externalRef: "id_pedido",
    source: "marketplace",
    payloadFields: ["produto"],
  },
  availableColumns: ["id_pedido", "marketplace", "produto", "prioridade"],
  totalRows: 2,
  validRows: 2,
  rejectedRows: 0,
  sampleRows: [
    { rowNumber: 1, externalRef: "ML-1", source: "mercado_livre", isValid: true, rejectionReason: null },
    { rowNumber: 2, externalRef: "ML-2", source: "mercado_livre", isValid: true, rejectionReason: null },
  ],
};

function renderWizard(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter initialEntries={["/imports/new"]}>
        <Routes>
          <Route path="imports/new" element={<ImportWizard />} />
          <Route path="imports/:batchId" element={<p>Detalhe do lote</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("ImportWizard", () => {
  it("exige um arquivo selecionado antes de enviar", async () => {
    const fetchMock = vi.fn();
    renderWizard(fetchMock);

    fireEvent.click(screen.getByTestId("upload-submit"));

    expect(await screen.findByText("Selecione um arquivo CSV ou XLSX para continuar.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia o arquivo, mostra o mapeamento sugerido e a pré-visualização", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, previewResponse));
    renderWizard(fetchMock);

    const file = new File(["id_pedido,marketplace\nML-1,mercado_livre"], "pedidos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("upload-submit"));

    await waitFor(() => expect(screen.getByTestId("mapping-external-ref")).toBeTruthy());
    expect((screen.getByTestId("mapping-external-ref") as HTMLSelectElement).value).toBe("id_pedido");
    expect((screen.getByTestId("mapping-source") as HTMLSelectElement).value).toBe("marketplace");
    expect(screen.getByText("ML-1")).toBeTruthy();
    expect(screen.getByText("ML-2")).toBeTruthy();
  });

  it("confirma a importação com o mapeamento ajustado e navega para o detalhe do lote", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, previewResponse))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: "batch-1",
          filename: "pedidos.csv",
          sourceType: "csv",
          status: "ready",
          totalItems: 2,
          validItems: 2,
          rejectedItems: 0,
          createdAt: new Date().toISOString(),
        })
      );
    renderWizard(fetchMock);

    const file = new File(["id_pedido,marketplace\nML-1,mercado_livre"], "pedidos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("upload-submit"));
    await waitFor(() => expect(screen.getByTestId("mapping-external-ref")).toBeTruthy());

    fireEvent.change(screen.getByTestId("mapping-external-ref"), { target: { value: "id_pedido" } });
    fireEvent.change(screen.getByTestId("mapping-source"), { target: { value: "marketplace" } });
    fireEvent.change(screen.getByTestId("mapping-priority"), { target: { value: "prioridade" } });
    fireEvent.click(screen.getByTestId("mapping-confirm"));

    await waitFor(() => expect(screen.getByText("Detalhe do lote")).toBeTruthy());
    const [, confirmInit] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(confirmInit.body)).toEqual({
      columnMapping: {
        externalRef: "id_pedido",
        source: "marketplace",
        priority: "prioridade",
        payloadFields: ["produto"],
      },
    });
  });

  it("mostra erro quando a confirmação falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, previewResponse))
      .mockResolvedValueOnce(jsonResponse(409, { error: "CONFLICT", message: "Lote já confirmado." }));
    renderWizard(fetchMock);

    const file = new File(["id_pedido,marketplace\nML-1,mercado_livre"], "pedidos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("upload-submit"));
    await waitFor(() => expect(screen.getByTestId("mapping-confirm")).toBeTruthy());

    fireEvent.click(screen.getByTestId("mapping-confirm"));

    expect(await screen.findByText("Lote já confirmado.")).toBeTruthy();
  });

  it("não é arrastado de volta pra tela do lote se o usuário já navegou pra outro lugar antes do confirm resolver", async () => {
    let resolveConfirm: (response: Response) => void = () => {};
    const pendingConfirm = new Promise<Response>((resolve) => {
      resolveConfirm = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, previewResponse))
      .mockImplementationOnce(() => pendingConfirm);

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <MemoryRouter initialEntries={["/imports/new"]}>
          <Link to="/queue">Fila</Link>
          <Routes>
            <Route path="imports/new" element={<ImportWizard />} />
            <Route path="imports/:batchId" element={<p>Detalhe do lote</p>} />
            <Route path="queue" element={<p>Tela da fila</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const file = new File(["id_pedido,marketplace\nML-1,mercado_livre"], "pedidos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("upload-submit"));
    await waitFor(() => expect(screen.getByTestId("mapping-confirm")).toBeTruthy());

    fireEvent.click(screen.getByTestId("mapping-confirm"));
    fireEvent.click(screen.getByText("Fila"));
    expect(screen.getByText("Tela da fila")).toBeTruthy();

    resolveConfirm(
      jsonResponse(200, {
        id: "batch-1",
        filename: "pedidos.csv",
        sourceType: "csv",
        status: "ready",
        totalItems: 2,
        validItems: 2,
        rejectedItems: 0,
        createdAt: new Date().toISOString(),
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("Tela da fila")).toBeTruthy();
    expect(screen.queryByText("Detalhe do lote")).toBeNull();
  });

  it("mostra erro quando o upload falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: "INVALID_FILE", message: "Arquivo inválido." }));
    renderWizard(fetchMock);

    const file = new File(["conteudo"], "pedidos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("upload-submit"));

    expect(await screen.findByText("Arquivo inválido.")).toBeTruthy();
  });
});
