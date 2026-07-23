import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { QueueManagementScreen } from "../QueueManagementScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const pendingItem = {
  id: "item-1",
  externalRef: "ML-1",
  source: "mercado_livre",
  productId: null,
  payload: {},
  priority: 0,
  status: "pending",
  createdAt: new Date().toISOString(),
  product: null,
};

const problemItem = { ...pendingItem, id: "item-2", externalRef: "ML-2", status: "problem" };
const completedItem = { ...pendingItem, id: "item-3", externalRef: "ML-3", status: "completed" };

function renderScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter>
        <QueueManagementScreen />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("QueueManagementScreen", () => {
  it("lista os itens da fila com status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("ML-1")).toBeTruthy();
    expect(screen.getByTestId("status-item-1").textContent).toBe("pending");
  });

  it("mostra a data de cadastro do produto vinculado, formatada em duas linhas", async () => {
    const linkedItem = {
      ...pendingItem,
      id: "item-linked",
      externalRef: "ML-LINKED",
      productId: "prod-1",
      product: {
        id: "prod-1",
        name: "Bolo Fake Rosa",
        description: null,
        attributes: {},
        assemblyItems: [],
        images: [],
        createdAt: new Date(2026, 2, 5, 9, 7, 3).toISOString(),
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [linkedItem], total: 1, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);

    await screen.findByText("ML-LINKED");
    const cell = screen.getByTestId("product-created-at-item-linked");
    expect(cell.textContent).toContain("/2026");
  });

  it("mostra '-' na data de cadastro quando o item não tem produto vinculado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await screen.findByText("ML-1");
    expect(screen.getByTestId("product-created-at-item-1").textContent).toBe("-");
  });

  it("mudar um filtro não busca imediatamente — espera o debounce", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("status-filter")).toBeTruthy());
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByTestId("search-filter"), { target: { value: "bolo" } });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=bolo"), expect.anything())
    );
  });

  it("aplica status, fonte, data e busca de texto juntos após o debounce", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("status-filter")).toBeTruthy());

    fireEvent.change(screen.getByTestId("status-filter"), { target: { value: "problem" } });
    fireEvent.change(screen.getByTestId("source-filter"), { target: { value: "shopee" } });
    fireEvent.change(screen.getByTestId("date-filter"), { target: { value: "2026-01-15" } });
    fireEvent.change(screen.getByTestId("search-filter"), { target: { value: "bolo" } });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("status=problem");
      expect(lastCall).toContain("source=shopee");
      expect(lastCall).toContain("from=2026-01-15");
      expect(lastCall).toContain("to=2026-01-15");
      expect(lastCall).toContain("q=bolo");
    });
  });

  it("data em branco não envia from/to (todas as datas)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("date-filter")).toBeTruthy());

    fireEvent.change(screen.getByTestId("date-filter"), { target: { value: "2026-01-15" } });
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("from=2026-01-15"));

    fireEvent.change(screen.getByTestId("date-filter"), { target: { value: "" } });
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).not.toContain("from=");
      expect(lastCall).not.toContain("to=");
    });
  });

  it("sempre busca com o pageSize máximo permitido (100)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("pageSize=100"), expect.anything()));
  });

  it("mudar um filtro depois de paginar volta pra página 1", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 250, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("page-next")).toBeTruthy());

    fireEvent.click(screen.getByTestId("page-next"));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("page=2"));

    fireEvent.change(screen.getByTestId("status-filter"), { target: { value: "pending" } });
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("status=pending");
      expect(lastCall).toContain("page=1");
    });
  });

  it("paginação: 'Próxima' avança de página, 'Anterior' fica desabilitado na primeira página", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 250, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("page-next")).toBeTruthy());

    expect(screen.getByTestId("page-prev")).toBeDisabled();
    expect(screen.getByText("Página 1 de 3")).toBeTruthy();

    fireEvent.click(screen.getByTestId("page-next"));

    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("page=2"));
  });

  it("desabilita 'Próxima' na última página", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [pendingItem], total: 50, page: 1, pageSize: 100 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("page-next")).toBeDisabled());
    expect(screen.getByText("Página 1 de 1")).toBeTruthy();
  });

  it("mostra 'Repor na fila' apenas para itens cancelled/problem, e 'Cancelar' para tudo exceto completed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [pendingItem, problemItem, completedItem], total: 3, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByText("ML-1")).toBeTruthy());

    expect(screen.queryByTestId("requeue-item-1")).toBeNull();
    expect(screen.getByTestId("requeue-item-2")).toBeTruthy();
    expect(screen.getByTestId("cancel-item-1")).toBeTruthy();
    expect(screen.getByTestId("cancel-item-2")).toBeTruthy();
    expect(screen.queryByTestId("cancel-item-3")).toBeNull();
  });

  it("repor na fila chama o endpoint e atualiza a lista", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/admin/queue/items/item-2/requeue")) {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(200, { items: [problemItem], total: 1, page: 1, pageSize: 20 }));
    });
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("requeue-item-2")).toBeTruthy());

    fireEvent.click(screen.getByTestId("requeue-item-2"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/queue/items/item-2/requeue"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("cancelar chama o endpoint e atualiza a lista", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/admin/queue/items/item-1/cancel")) {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(200, { items: [pendingItem], total: 1, page: 1, pageSize: 20 }));
    });
    renderScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("cancel-item-1")).toBeTruthy());

    fireEvent.click(screen.getByTestId("cancel-item-1"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/queue/items/item-1/cancel"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("define as regras de prioridade e mostra a confirmação", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.endsWith("/admin/queue/rules")) {
        return Promise.resolve(
          jsonResponse(200, {
            rules: [
              { source: "mercado_livre", priority: 2, isActive: true },
              { source: "shopee", priority: 1, isActive: true },
              { source: "ebay", priority: 0, isActive: true },
            ],
          })
        );
      }
      return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    });
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("priority-save")).toBeTruthy());
    fireEvent.change(screen.getByTestId("priority-mercado_livre"), { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("priority-save"));

    expect(await screen.findByText("Regras de prioridade atualizadas.")).toBeTruthy();
  });
});
