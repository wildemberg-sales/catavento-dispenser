import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider } from "../../../auth/AuthContext";
import { ProblemsScreen } from "../ProblemsScreen";

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
      <ProblemsScreen />
    </AuthProvider>
  );
}

function problemItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-problema-1",
    externalRef: "ML-999",
    source: "mercado_livre",
    payload: { nome: "Bolo Fake Azul" },
    batchId: "batch-1",
    createdAt: "2026-01-01T09:00:00.000Z",
    productName: "Bolo Fake Azul",
    problemNote: "Faltou o topo do bolo na caixa",
    reportedAt: "2026-01-01T10:00:00.000Z",
    operatorId: "op-1",
    operatorDisplayName: "Fulano",
    ...overrides,
  };
}

describe("ProblemsScreen", () => {
  it("busca com o teto de pageSize permitido pela API ao montar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("pageSize=100"), expect.anything()));
  });

  it("mostra estado vazio quando não há itens com problema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("Nenhum item com problema no momento.")).toBeTruthy();
  });

  it("lista itens com status problem, mostrando a nota e quem reportou", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [problemItem()], total: 1, page: 1, pageSize: 100 })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Bolo Fake Azul")).toBeTruthy();
    expect(screen.getByText("Faltou o topo do bolo na caixa")).toBeTruthy();
    expect(screen.getByText(/reportado por Fulano/)).toBeTruthy();
  });

  it("item sem produto vinculado usa o payload cru como fallback de nome", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [problemItem({ productName: null, payload: { name: "Bolo Fake Verde" } })],
        total: 1,
        page: 1,
        pageSize: 100,
      })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Bolo Fake Verde")).toBeTruthy();
  });

  it("item sem produto e sem nome no payload cai pra referência externa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [problemItem({ productName: null, payload: {} })],
        total: 1,
        page: 1,
        pageSize: 100,
      })
    );
    renderScreen(fetchMock);

    expect((await screen.findAllByText("ML-999")).length).toBeGreaterThan(0);
  });

  it("item sem observação registrada mostra o texto padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [problemItem({ problemNote: null })], total: 1, page: 1, pageSize: 100 })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Sem observação registrada.")).toBeTruthy();
  });

  it("'Repor na fila' chama o endpoint de requeue e recarrega a lista", async () => {
    let requeued = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith(`/admin/queue/items/${problemItem().id}/requeue`)) {
        requeued = true;
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      if (url.includes("/admin/queue/problems")) {
        return Promise.resolve(
          jsonResponse(200, { items: requeued ? [] : [problemItem()], total: requeued ? 0 : 1, page: 1, pageSize: 100 })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);

    await screen.findByText("Bolo Fake Azul");
    fireEvent.click(screen.getByTestId(`problem-requeue-${problemItem().id}`));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/queue/items/${problemItem().id}/requeue`),
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(screen.queryByText("Bolo Fake Azul")).toBeNull());
  });

  it("'Cancelar' chama o endpoint de cancelamento e recarrega a lista", async () => {
    let cancelled = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith(`/admin/queue/items/${problemItem().id}/cancel`)) {
        cancelled = true;
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      if (url.includes("/admin/queue/problems")) {
        return Promise.resolve(
          jsonResponse(200, { items: cancelled ? [] : [problemItem()], total: cancelled ? 0 : 1, page: 1, pageSize: 100 })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);

    await screen.findByText("Bolo Fake Azul");
    fireEvent.click(screen.getByTestId(`problem-cancel-${problemItem().id}`));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/queue/items/${problemItem().id}/cancel`),
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(screen.queryByText("Bolo Fake Azul")).toBeNull());
  });

  it("mostra erro inline quando a busca falha", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede"));
    renderScreen(fetchMock);

    expect(await screen.findByText("Não foi possível carregar os itens com problema.")).toBeTruthy();
  });

  it("mostra paginação apenas quando o total excede o tamanho da página, e a próxima página busca page=2", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [problemItem()], total: 150, page: 1, pageSize: 100 })
    );
    renderScreen(fetchMock);

    await screen.findByText("Bolo Fake Azul");
    expect(screen.getByText("Página 1 de 2")).toBeTruthy();

    fireEvent.click(screen.getByTestId("page-next"));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("page=2");
    });
  });

  it("não mostra paginação quando o total cabe em uma página", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [problemItem()], total: 1, page: 1, pageSize: 100 })
    );
    renderScreen(fetchMock);

    await screen.findByText("Bolo Fake Azul");
    expect(screen.queryByTestId("page-next")).toBeNull();
  });
});
