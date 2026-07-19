import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ImportDetailScreen } from "../ImportDetailScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const readyBatch = {
  id: "batch-1",
  filename: "pedidos-julho.csv",
  sourceType: "csv",
  status: "ready",
  totalItems: 2,
  validItems: 2,
  rejectedItems: 0,
  createdAt: new Date().toISOString(),
};

const processingBatch = { ...readyBatch, status: "processing" };

function jsonResponseFor(url: string): Response {
  if (url.endsWith("/admin/imports/batch-1")) return jsonResponse(200, readyBatch);
  if (url.includes("/rows")) {
    return jsonResponse(200, {
      items: [
        { rowNumber: 1, externalRef: "ML-1", source: "mercado_livre", isValid: true, rejectionReason: null, payload: {} },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  }
  if (url.includes("/unlinked")) {
    return jsonResponse(200, {
      items: [
        {
          id: "item-1",
          externalRef: "ML-2",
          source: "mercado_livre",
          payload: { nome: "Bolo unicórnio" },
          suggestions: [{ productId: "prod-1", productName: "Bolo Fake Unicórnio", score: 0.8 }],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  }
  throw new Error(`unexpected url: ${url}`);
}

function renderScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter initialEntries={["/imports/batch-1"]}>
        <Routes>
          <Route path="imports/new" element={<p>Assistente de nova importação</p>} />
          <Route path="imports/:batchId" element={<ImportDetailScreen />} />
          <Route path="reconciliation" element={<p>Itens sem vínculo</p>} />
          <Route path="products/new" element={<p>Novo produto</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("ImportDetailScreen", () => {
  it("mostra aviso de mapeamento pendente quando o lote ainda está processing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, processingBatch));
    renderScreen(fetchMock);

    expect(
      await screen.findByText(
        "Mapeamento pendente — os dados de pré-visualização foram perdidos. Refaça a importação para continuar."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Nova importação"));
    expect(await screen.findByText("Assistente de nova importação")).toBeTruthy();
  });

  it("mostra os dados do lote, as linhas e os itens não vinculados com sugestões", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonResponseFor(String(input))));
    renderScreen(fetchMock);

    expect(await screen.findByText("pedidos-julho.csv")).toBeTruthy();
    expect(await screen.findByText("ML-1")).toBeTruthy();
    expect(await screen.findByText("Bolo unicórnio")).toBeTruthy();
    expect(screen.getByText(/Bolo Fake Unicórnio/)).toBeTruthy();
  });

  it("vincular por SKU chama o endpoint e mostra o resultado", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/admin/imports/batch-1/link")) {
        return Promise.resolve(jsonResponse(200, { linkedCount: 1, totalItems: 2 }));
      }
      return Promise.resolve(jsonResponseFor(url));
    });
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("link-by-sku-button")).toBeTruthy());
    fireEvent.click(screen.getByTestId("link-by-sku-button"));

    expect(await screen.findByText("1 de 2 itens vinculados automaticamente.")).toBeTruthy();
  });

  it("vincular manualmente uma sugestão chama o endpoint de link do item", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/admin/queue/items/item-1/link")) {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponseFor(url));
    });
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("link-suggestion-prod-1")).toBeTruthy());
    fireEvent.click(screen.getByTestId("link-suggestion-prod-1"));

    const linkCall = await waitFor(() =>
      fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    );
    expect(linkCall).toBeTruthy();
    const [, init] = linkCall!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ productId: "prod-1" });
  });

  it("mostra um aviso quando há itens sem vínculo, com link para a reconciliação", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonResponseFor(String(input))));
    renderScreen(fetchMock);

    expect(
      await screen.findByText("1 item não pôde ser vinculado automaticamente.")
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("go-to-reconciliation"));
    expect(await screen.findByText("Itens sem vínculo")).toBeTruthy();
  });

  it("botão de cadastrar produto por item navega com o prefill correto", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(jsonResponseFor(String(input))));
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByTestId("register-product-item-1"));

    expect(await screen.findByText("Novo produto")).toBeTruthy();
  });

  it("mostra o aviso no plural quando há mais de um item sem vínculo, e usa a referência externa quando falta nome no payload", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/admin/imports/batch-1")) return Promise.resolve(jsonResponse(200, readyBatch));
      if (url.includes("/rows")) return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      if (url.includes("/unlinked")) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              { id: "item-2", externalRef: "ML-3", source: "mercado_livre", payload: {}, suggestions: [] },
              { id: "item-3", externalRef: "ML-4", source: "mercado_livre", payload: {}, suggestions: [] },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          })
        );
      }
      throw new Error(`unexpected url: ${url}`);
    });
    renderScreen(fetchMock);

    expect(await screen.findByText("2 itens não puderam ser vinculados automaticamente.")).toBeTruthy();
    expect(await screen.findByText("ML-3")).toBeTruthy();
  });
});
