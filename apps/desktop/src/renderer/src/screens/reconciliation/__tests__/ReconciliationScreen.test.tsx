import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ReconciliationScreen } from "../ReconciliationScreen";

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
      <MemoryRouter initialEntries={["/reconciliation"]}>
        <Routes>
          <Route path="reconciliation" element={<ReconciliationScreen />} />
          <Route path="products/new" element={<p>Novo produto</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function unlinkedItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    externalRef: "ML-999",
    source: "mercado_livre",
    payload: { nome: "Bolo Fake Rosa 2 Andares" },
    batchId: "batch-1",
    createdAt: new Date().toISOString(),
    suggestions: [],
    ...overrides,
  };
}

describe("ReconciliationScreen", () => {
  it("mostra estado vazio quando não há itens sem vínculo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("Todos os itens estão vinculados a um produto.")).toBeTruthy();
  });

  it("lista itens sem vínculo com referência e fonte", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [unlinkedItem()], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Bolo Fake Rosa 2 Andares")).toBeTruthy();
    expect(screen.getByText("ML-999")).toBeTruthy();
  });

  it("usa payload.name quando não há payload.nome", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [unlinkedItem({ payload: { name: "Bolo Fake Azul" } })],
        total: 1,
        page: 1,
        pageSize: 20,
      })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Bolo Fake Azul")).toBeTruthy();
  });

  it("usa a referência externa quando o payload não tem nome", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [unlinkedItem({ payload: {} })], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    expect(await screen.findAllByText("ML-999")).toHaveLength(2);
  });

  it("vincula por sugestão e remove o item da lista", async () => {
    const item = unlinkedItem({
      suggestions: [{ productId: "prod-1", productName: "Bolo Fake Rosa 2 Andares Original", score: 0.8 }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [item], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByTestId("link-suggestion-item-1-prod-1"));

    await waitFor(() => expect(screen.getByText("Todos os itens estão vinculados a um produto.")).toBeTruthy());
    const linkCall = fetchMock.mock.calls.find(([url]) => (url as string).includes("/admin/queue/items/item-1/link"));
    expect(linkCall).toBeTruthy();
  });

  it("botão de cadastrar produto navega com o prefill correto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [unlinkedItem()], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByTestId("register-product-item-1"));

    expect(await screen.findByText("Novo produto")).toBeTruthy();
  });
});
