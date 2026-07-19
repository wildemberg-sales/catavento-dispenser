import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { ProductForm } from "../ProductForm";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function renderScreen(
  fetchMock: typeof fetch,
  options: { initialEntry?: string; state?: unknown } = {}
) {
  const entry = options.state
    ? { pathname: options.initialEntry ?? "/products/new", state: options.state }
    : options.initialEntry ?? "/products/new";

  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:productId/edit" element={<ProductForm />} />
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

describe("ProductForm — criação", () => {
  it("cria um produto com nome, itens de montagem e sku, depois navega para a edição", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product({ id: "prod-novo" })));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("product-name")).toBeTruthy());
    fireEvent.change(screen.getByTestId("product-name"), { target: { value: "Bolo Fake Rosa 2 Andares" } });
    fireEvent.change(screen.getByTestId("assembly-item-input"), { target: { value: "Base de isopor" } });
    fireEvent.click(screen.getByTestId("add-assembly-item"));
    fireEvent.change(screen.getByTestId("sku-mercado_livre"), { target: { value: "ML-123" } });

    fireEvent.click(screen.getByTestId("product-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/products/"));
      expect(call).toBeTruthy();
    });
    const [, options] = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/products/"))!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.name).toBe("Bolo Fake Rosa 2 Andares");
    expect(body.assemblyItems).toEqual(["Base de isopor"]);
    expect(body.skus).toEqual([{ source: "mercado_livre", sku: "ML-123" }]);

    expect(await screen.findByTestId("product-name")).toBeTruthy();
  });

  it("recebe prefill de nome e SKU vindos da reconciliação, e vincula o item ao criar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, product({ id: "prod-novo" })))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValue(jsonResponse(200, product({ id: "prod-novo" })));
    renderScreen(fetchMock, {
      state: { prefillName: "Bolo Fake Azul", prefillSku: { source: "shopee", sku: "SHP-9" }, fromQueueItemId: "item-42" },
    });

    await waitFor(() => expect(screen.getByTestId("product-name")).toHaveValue("Bolo Fake Azul"));
    expect(screen.getByTestId("sku-shopee")).toHaveValue("SHP-9");

    fireEvent.click(screen.getByTestId("product-submit"));

    await waitFor(() => {
      const linkCall = fetchMock.mock.calls.find(([url]) => (url as string).includes("/admin/queue/items/item-42/link"));
      expect(linkCall).toBeTruthy();
    });
  });

  it("permite remover um item de montagem já adicionado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product()));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("assembly-item-input")).toBeTruthy());
    fireEvent.change(screen.getByTestId("assembly-item-input"), { target: { value: "Fita decorativa" } });
    fireEvent.click(screen.getByTestId("add-assembly-item"));

    expect(await screen.findByText("Fita decorativa")).toBeTruthy();
    fireEvent.click(screen.getByTestId("remove-assembly-item-0"));

    await waitFor(() => expect(screen.queryByText("Fita decorativa")).toBeNull());
  });

  it("clicar em Adicionar sem texto não adiciona item vazio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product()));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("add-assembly-item")).toBeTruthy());
    fireEvent.click(screen.getByTestId("add-assembly-item"));

    expect(screen.queryByTestId("remove-assembly-item-0")).toBeNull();
  });

  it("envia a descrição preenchida ao criar o produto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product()));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("product-name")).toBeTruthy());
    fireEvent.change(screen.getByTestId("product-name"), { target: { value: "Bolo Fake Verde" } });
    fireEvent.change(screen.getByTestId("product-description"), { target: { value: "Bolo de dois andares" } });
    fireEvent.click(screen.getByTestId("product-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/products/"));
      expect(call).toBeTruthy();
    });
    const [, options] = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/products/"))!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.description).toBe("Bolo de dois andares");
  });

  it("preenche a descrição do produto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product()));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("product-description")).toBeTruthy());
    fireEvent.change(screen.getByTestId("product-description"), { target: { value: "Bolo de dois andares" } });

    expect(screen.getByTestId("product-description")).toHaveValue("Bolo de dois andares");
  });

  it("mostra erro retornado pelo backend ao criar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { message: "Nome do produto é obrigatório.", error: "VALIDATION_ERROR" })
    );
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("product-name")).toBeTruthy());
    fireEvent.click(screen.getByTestId("product-submit"));

    expect(await screen.findByText("Nome do produto é obrigatório.")).toBeTruthy();
  });
});

describe("ProductForm — edição", () => {
  it("carrega dados existentes e salva alterações via PUT", async () => {
    const existing = product({
      description: "Descrição original",
      assemblyItems: ["Base de isopor"],
      skus: [{ id: "sku-1", source: "ebay", sku: "EB-1" }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, existing))
      .mockResolvedValue(jsonResponse(200, { ...existing, name: "Bolo Fake Rosa Atualizado" }));
    renderScreen(fetchMock, { initialEntry: "/products/prod-1/edit" });

    expect(await screen.findByTestId("product-name")).toHaveValue(existing.name);
    expect(screen.getByTestId("sku-ebay")).toHaveValue("EB-1");

    fireEvent.change(screen.getByTestId("product-name"), { target: { value: "Bolo Fake Rosa Atualizado" } });
    fireEvent.click(screen.getByTestId("product-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, options]) => (url as string).endsWith("/admin/products/prod-1") && (options as RequestInit)?.method === "PUT"
      );
      expect(call).toBeTruthy();
    });
  });

  it("não mostra a galeria de imagens no modo de criação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, product()));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("product-name")).toBeTruthy());
    expect(screen.queryByTestId("upload-image-input")).toBeNull();
  });

  it("mostra as fotos existentes ordenadas por position", async () => {
    const existing = product({
      images: [
        { id: "img-b", url: "http://localhost:3000/uploads/b.png", position: 1 },
        { id: "img-a", url: "http://localhost:3000/uploads/a.png", position: 0 },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, existing));
    renderScreen(fetchMock, { initialEntry: "/products/prod-1/edit" });

    const images = await screen.findAllByRole("img");
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "http://localhost:3000/uploads/a.png",
      "http://localhost:3000/uploads/b.png",
    ]);
  });

  it("envia uma foto selecionada e adiciona na galeria", async () => {
    const existing = product({ images: [] });
    const uploaded = { id: "img-novo", url: "http://localhost:3000/uploads/novo.png", position: 0 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, existing))
      .mockResolvedValueOnce(jsonResponse(201, uploaded));
    renderScreen(fetchMock, { initialEntry: "/products/prod-1/edit" });

    await waitFor(() => expect(screen.getByTestId("upload-image-input")).toBeTruthy());
    const file = new File(["conteudo"], "novo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("upload-image-input"), { target: { files: [file] } });

    expect(await screen.findByAltText("novo.png")).toBeTruthy();
    const uploadCall = fetchMock.mock.calls.find(([url]) => (url as string).includes("/admin/products/prod-1/images"));
    expect(uploadCall).toBeTruthy();
  });

  it("exclui uma foto da galeria", async () => {
    const existing = product({
      images: [{ id: "img-a", url: "http://localhost:3000/uploads/a.png", position: 0 }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, existing))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    renderScreen(fetchMock, { initialEntry: "/products/prod-1/edit" });

    fireEvent.click(await screen.findByTestId("delete-image-img-a"));

    await waitFor(() => expect(screen.queryByAltText("a.png")).toBeNull());
    const deleteCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        (url as string).includes("/admin/products/prod-1/images/img-a") && (options as RequestInit)?.method === "DELETE"
    );
    expect(deleteCall).toBeTruthy();
  });

  it("mostra erro quando o backend rejeita o tipo de arquivo", async () => {
    const existing = product({ images: [] });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, existing))
      .mockResolvedValueOnce(
        jsonResponse(400, { message: "Tipo de arquivo de imagem não suportado. Envie JPEG, PNG ou WebP.", error: "INVALID_IMAGE_TYPE" })
      );
    renderScreen(fetchMock, { initialEntry: "/products/prod-1/edit" });

    await waitFor(() => expect(screen.getByTestId("upload-image-input")).toBeTruthy());
    const file = new File(["conteudo"], "arquivo.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("upload-image-input"), { target: { files: [file] } });

    expect(await screen.findByText("Tipo de arquivo de imagem não suportado. Envie JPEG, PNG ou WebP.")).toBeTruthy();
  });
});
