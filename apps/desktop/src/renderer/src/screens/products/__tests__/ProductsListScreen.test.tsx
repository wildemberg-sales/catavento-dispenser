import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ProductsListScreen } from "../ProductsListScreen";

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
      <MemoryRouter initialEntries={["/products"]}>
        <Routes>
          <Route path="products" element={<ProductsListScreen />} />
          <Route path="products/new" element={<p>Novo produto</p>} />
          <Route path="products/:productId/edit" element={<p>Editar produto</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "prod-1",
    name: "Bolo Fake Rosa 2 Andares",
    description: null,
    attributes: {},
    assemblyItems: [],
    isActive: true,
    skus: [],
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ProductsListScreen", () => {
  it("mostra estado vazio quando não há produtos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("Nenhum produto cadastrado ainda.")).toBeTruthy();
  });

  it("lista produtos com nome e status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [product()], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    expect(await screen.findByText("Bolo Fake Rosa 2 Andares")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
  });

  it("clicar em um produto navega para a edição", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [product()], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByText("Bolo Fake Rosa 2 Andares"));

    expect(await screen.findByText("Editar produto")).toBeTruthy();
  });

  it("botão de novo produto navega para o cadastro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("new-product-button")).toBeTruthy());
    fireEvent.click(screen.getByTestId("new-product-button"));

    expect(await screen.findByText("Novo produto")).toBeTruthy();
  });

  it("busca refaz a listagem com o termo digitado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("products-search")).toBeTruthy());
    fireEvent.change(screen.getByTestId("products-search"), { target: { value: "bolo rosa" } });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("search=bolo");
    });
  });

  it("toggle de incluir inativos refaz a listagem", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("include-inactive-toggle")).toBeTruthy());
    fireEvent.click(screen.getByTestId("include-inactive-toggle"));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("includeInactive=true");
    });
  });

  it("botão de desativar chama o endpoint e atualiza a lista", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [product()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByTestId("deactivate-prod-1"));

    await waitFor(() => expect(screen.getByText("Nenhum produto cadastrado ainda.")).toBeTruthy());
    const deactivateCall = fetchMock.mock.calls.find(([, options]) => (options as RequestInit)?.method === "DELETE");
    expect(deactivateCall?.[0]).toContain("/admin/products/prod-1");
  });

  it("produto inativo mostra botão de reativar em vez de desativar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [product({ id: "prod-2", isActive: false })], total: 1, page: 1, pageSize: 20 })
    );
    renderScreen(fetchMock);

    expect(await screen.findByTestId("reactivate-prod-2")).toBeTruthy();
    expect(screen.queryByTestId("deactivate-prod-2")).toBeNull();
    expect(screen.getByText("Inativo")).toBeTruthy();
  });

  it("botão de reativar chama o endpoint e atualiza a lista", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [product({ id: "prod-2", isActive: false })], total: 1, page: 1, pageSize: 20 })
      )
      .mockResolvedValueOnce(jsonResponse(200, product({ id: "prod-2", isActive: true })))
      .mockResolvedValue(jsonResponse(200, { items: [product({ id: "prod-2", isActive: true })], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    fireEvent.click(await screen.findByTestId("reactivate-prod-2"));

    await waitFor(() => expect(screen.getByTestId("deactivate-prod-2")).toBeTruthy());
    const reactivateCall = fetchMock.mock.calls.find(([, options]) => (options as RequestInit)?.method === "PUT");
    expect(reactivateCall?.[0]).toContain("/admin/products/prod-2");
  });

  it("mostra a miniatura da primeira foto ordenada por position", async () => {
    const withImages = product({
      images: [
        { id: "img-b", url: "http://localhost:3000/uploads/b.png", position: 1 },
        { id: "img-a", url: "http://localhost:3000/uploads/a.png", position: 0 },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [withImages], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    const thumbnail = await screen.findByAltText("Bolo Fake Rosa 2 Andares");
    expect(thumbnail.getAttribute("src")).toBe("http://localhost:3000/uploads/a.png");
  });
});
