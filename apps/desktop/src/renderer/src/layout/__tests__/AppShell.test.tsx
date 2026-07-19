import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "../AppShell";
import { AuthProvider } from "../../auth/AuthContext";

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
});
