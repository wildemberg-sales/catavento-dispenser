import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "../AppShell";
import { AuthProvider } from "../../auth/AuthContext";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function renderShell(fetchMock: typeof fetch, initialEntry = "/imports") {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="imports" element={<div>Conteúdo de importações</div>} />
            <Route path="queue" element={<div>Conteúdo de fila</div>} />
            <Route path="products" element={<div>Conteúdo de produtos</div>} />
            <Route path="reconciliation" element={<div>Conteúdo de reconciliação</div>} />
            <Route path="monitor" element={<div>Conteúdo do monitor</div>} />
            <Route path="problems" element={<div>Conteúdo de problemas</div>} />
            <Route path="reports" element={<div>Conteúdo de relatórios</div>} />
            <Route path="users" element={<div>Conteúdo de usuários</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("AppShell", () => {
  it("renderiza os links de navegação e o conteúdo da rota ativa", () => {
    renderShell(vi.fn());

    expect(screen.getByText("Importações")).toBeTruthy();
    expect(screen.getByText("Fila")).toBeTruthy();
    expect(screen.getByText("Conteúdo de importações")).toBeTruthy();
  });

  it("navega para outra seção ao clicar no link da sidebar", () => {
    renderShell(vi.fn());

    fireEvent.click(screen.getByText("Fila"));

    expect(screen.getByText("Conteúdo de fila")).toBeTruthy();
  });

  it("mostra os links de Produtos e Sem vínculo e navega para eles", () => {
    renderShell(vi.fn());

    expect(screen.getByText("Produtos")).toBeTruthy();
    expect(screen.getByText("Sem vínculo")).toBeTruthy();

    fireEvent.click(screen.getByText("Produtos"));
    expect(screen.getByText("Conteúdo de produtos")).toBeTruthy();

    fireEvent.click(screen.getByText("Sem vínculo"));
    expect(screen.getByText("Conteúdo de reconciliação")).toBeTruthy();
  });

  it("mostra o link de Monitor e navega pra ele", () => {
    renderShell(vi.fn());

    fireEvent.click(screen.getByText("Monitor"));
    expect(screen.getByText("Conteúdo do monitor")).toBeTruthy();
  });

  it("mostra o link de Problemas e navega pra ele", () => {
    renderShell(vi.fn());

    fireEvent.click(screen.getByText("Problemas"));
    expect(screen.getByText("Conteúdo de problemas")).toBeTruthy();
  });

  it("mostra o link de Relatórios e navega pra ele", () => {
    renderShell(vi.fn());

    fireEvent.click(screen.getByText("Relatórios"));
    expect(screen.getByText("Conteúdo de relatórios")).toBeTruthy();
  });

  it("mostra o link de Usuários e navega pra ele", () => {
    renderShell(vi.fn());

    fireEvent.click(screen.getByText("Usuários"));
    expect(screen.getByText("Conteúdo de usuários")).toBeTruthy();
  });

  it("botão de sair chama logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) } as Response);
    renderShell(fetchMock);

    fireEvent.click(screen.getByTestId("logout-btn"));

    expect(secureStoreMock.delete).toBeDefined();
  });

  describe("badge de problemas", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("mostra a contagem de itens com problema ao lado do link, buscando com pageSize=1", async () => {
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/queue/problems")) {
          return Promise.resolve(jsonResponse(200, { items: [], total: 3, page: 1, pageSize: 1 }));
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });
      renderShell(fetchMock);

      expect(await screen.findByTestId("problems-badge")).toHaveTextContent("3");
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("pageSize=1"), expect.anything());
    });

    it("não mostra o badge quando não há itens com problema", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 1 }));
      renderShell(fetchMock);

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(screen.queryByTestId("problems-badge")).toBeNull();
    });

    it("verifica de novo a cada 10 segundos e atualiza o badge", async () => {
      vi.useFakeTimers();
      let total = 0;
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/queue/problems")) {
          return Promise.resolve(jsonResponse(200, { items: [], total, page: 1, pageSize: 1 }));
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });
      renderShell(fetchMock);

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId("problems-badge")).toBeNull();

      total = 2;
      await vi.advanceTimersByTimeAsync(10000);
      await vi.waitFor(() => expect(screen.getByTestId("problems-badge")).toHaveTextContent("2"));
    });

    it("uma falha pontual na checagem não derruba o badge — mantém o último valor conhecido", async () => {
      let shouldFail = false;
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/queue/problems")) {
          if (shouldFail) return Promise.reject(new Error("falha de rede"));
          return Promise.resolve(jsonResponse(200, { items: [], total: 5, page: 1, pageSize: 1 }));
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });
      renderShell(fetchMock);

      expect(await screen.findByTestId("problems-badge")).toHaveTextContent("5");

      shouldFail = true;
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await vi.advanceTimersByTimeAsync(10000);

      expect(screen.getByTestId("problems-badge")).toHaveTextContent("5");
    });

    it("desmontar antes da checagem resolver não atualiza estado (sem warning de setState pós-desmonte)", async () => {
      let resolveProblems!: (value: Response) => void;
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveProblems = resolve;
          })
      );
      const { unmount } = renderShell(fetchMock);

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      unmount();

      // resolve só depois do unmount — se o guard `cancelled` não existisse,
      // isso chamaria setState num componente já desmontado.
      resolveProblems(jsonResponse(200, { items: [], total: 4, page: 1, pageSize: 1 }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.queryByTestId("problems-badge")).toBeNull();
    });
  });
});
