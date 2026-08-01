import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ImportsListScreen } from "../ImportsListScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function renderScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter initialEntries={["/imports"]}>
        <Routes>
          <Route path="imports" element={<ImportsListScreen />} />
          <Route path="imports/new" element={<p>Assistente de nova importação</p>} />
          <Route path="imports/:batchId" element={<p>Detalhe do lote</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("ImportsListScreen", () => {
  it("mostra estado vazio quando não há lotes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("Nenhuma importação ainda.")).toBeTruthy();
  });

  it("lista os lotes com status e contadores", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            id: "batch-1",
            filename: "pedidos-julho.csv",
            sourceType: "csv",
            status: "ready",
            totalItems: 10,
            validItems: 9,
            rejectedItems: 1,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("pedidos-julho.csv")).toBeTruthy();
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByText("9 / 10")).toBeTruthy();
  });

  it("clicar em um lote navega para o detalhe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            id: "batch-1",
            filename: "pedidos-julho.csv",
            sourceType: "csv",
            status: "ready",
            totalItems: 10,
            validItems: 9,
            rejectedItems: 1,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })
    );
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByText("pedidos-julho.csv"));

    expect(await screen.findByText("Detalhe do lote")).toBeTruthy();
  });

  it("botão de nova importação navega para o assistente", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("new-import-button")).toBeTruthy());
    fireEvent.click(screen.getByTestId("new-import-button"));

    expect(await screen.findByText("Assistente de nova importação")).toBeTruthy();
  });

  it("mostra a mensagem do servidor quando a busca falha com um erro de domínio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { error: "FORBIDDEN", message: "Sem permissão." }));
    renderScreen(fetchMock);

    expect(await screen.findByText("Sem permissão.")).toBeTruthy();
  });

  it("mostra mensagem padrão quando a busca falha por um erro que não é de domínio", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede"));
    renderScreen(fetchMock);

    expect(await screen.findByText("Não foi possível carregar as importações.")).toBeTruthy();
  });
});
