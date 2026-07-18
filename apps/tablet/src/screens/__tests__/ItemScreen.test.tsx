import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import type { QueueItemDTO } from "@catavento/contracts/queue";
import { AuthProvider } from "../../auth/AuthContext";
import { ItemScreen } from "../ItemScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};

const rawItem: QueueItemDTO = {
  id: "item-1",
  externalRef: "ML-1",
  source: "mercado_livre",
  productId: null,
  payload: { title: "Caixa azul 10x10" },
  priority: 0,
  status: "in_progress",
  createdAt: new Date().toISOString(),
  product: null,
};

const linkedItem = {
  ...rawItem,
  id: "item-2",
  productId: "prod-1",
  product: {
    id: "prod-1",
    name: "Bolo fake 2 andares - tema unicórnio",
    description: "Bolo fake para vitrine, decoração em pasta americana",
    attributes: { cor: "rosa" },
    assemblyItems: ["Base de isopor 25cm", "Cobertura de pasta americana branca", "Fita de cetim rosa"],
    images: [
      { url: "https://example.com/a.jpg", position: 0 },
      { url: "https://example.com/b.jpg", position: 1 },
    ],
  },
};

function renderItemScreen(fetchMock: jest.Mock, navigation: { replace: jest.Mock }, item = rawItem) {
  return render(
    <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <ItemScreen navigation={navigation as never} route={{ params: { item } } as never} />
    </AuthProvider>
  );
}

describe("ItemScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
    await require("@react-native-async-storage/async-storage").clear();
  });

  it("mostra o payload cru quando o item não tem produto vinculado", async () => {
    const navigation = { replace: jest.fn() };
    await renderItemScreen(jest.fn(), navigation, rawItem);

    expect(await screen.findByText("Produto sem cadastro")).toBeTruthy();
    expect(screen.getByText(/Caixa azul 10x10/)).toBeTruthy();
  });

  it("mostra os dados do produto vinculado quando presente", async () => {
    const navigation = { replace: jest.fn() };
    await renderItemScreen(jest.fn(), navigation, linkedItem);

    expect(await screen.findByText("Bolo fake 2 andares - tema unicórnio")).toBeTruthy();
    expect(screen.getByText("Bolo fake para vitrine, decoração em pasta americana")).toBeTruthy();
  });

  it("mostra os dados do produto vinculado sem descrição quando ela é nula", async () => {
    const navigation = { replace: jest.fn() };
    const itemSemDescricao = { ...linkedItem, product: { ...linkedItem.product, description: null } };
    await renderItemScreen(jest.fn(), navigation, itemSemDescricao);

    expect(await screen.findByText("Bolo fake 2 andares - tema unicórnio")).toBeTruthy();
    expect(screen.queryByText("Bolo fake para vitrine, decoração em pasta americana")).toBeNull();
  });

  it("mostra a lista de itens de montagem quando o produto vinculado tem uma", async () => {
    const navigation = { replace: jest.fn() };
    await renderItemScreen(jest.fn(), navigation, linkedItem);

    expect(await screen.findByText("Itens para montagem")).toBeTruthy();
    expect(screen.getByText(/Base de isopor 25cm/)).toBeTruthy();
    expect(screen.getByText(/Cobertura de pasta americana branca/)).toBeTruthy();
    expect(screen.getByText(/Fita de cetim rosa/)).toBeTruthy();
  });

  it("não mostra a seção de itens de montagem quando o produto vinculado não tem lista", async () => {
    const navigation = { replace: jest.fn() };
    const semLista = { ...linkedItem, product: { ...linkedItem.product, assemblyItems: [] } };
    await renderItemScreen(jest.fn(), navigation, semLista);

    await screen.findByText("Bolo fake 2 andares - tema unicórnio");
    expect(screen.queryByText("Itens para montagem")).toBeNull();
  });

  it("concluir com sucesso volta para a tela principal", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(204, {}));
    const navigation = { replace: jest.fn() };
    await renderItemScreen(fetchMock, navigation, rawItem);

    await fireEvent.press(screen.getByTestId("item-complete-button"));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Main"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue/items/item-1/complete"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reportar problema exige nota antes de enviar", async () => {
    const navigation = { replace: jest.fn() };
    await renderItemScreen(jest.fn(), navigation, rawItem);

    await fireEvent.press(screen.getByTestId("item-report-button"));
    await fireEvent.press(screen.getByTestId("item-problem-submit"));

    expect(await screen.findByText("Descreva o problema antes de enviar.")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("reportar problema com nota volta para a tela principal", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(204, {}));
    const navigation = { replace: jest.fn() };
    await renderItemScreen(fetchMock, navigation, rawItem);

    await fireEvent.press(screen.getByTestId("item-report-button"));
    await fireEvent.changeText(screen.getByTestId("item-problem-note"), "Item quebrado");
    await fireEvent.press(screen.getByTestId("item-problem-submit"));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Main"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/queue/items/item-1/problem"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falha de rede ao concluir enfileira a ação e ainda assim volta para a tela principal", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const navigation = { replace: jest.fn() };
    await renderItemScreen(fetchMock, navigation, rawItem);

    await fireEvent.press(screen.getByTestId("item-complete-button"));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Main"));

    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const stored = await AsyncStorage.getItem("catavento.pendingActions");
    expect(JSON.parse(stored)).toEqual([{ queueItemId: "item-1", type: "complete", note: undefined }]);
  });

  it("falha de rede ao reportar problema enfileira a ação e ainda assim volta para a tela principal", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const navigation = { replace: jest.fn() };
    await renderItemScreen(fetchMock, navigation, rawItem);

    await fireEvent.press(screen.getByTestId("item-report-button"));
    await fireEvent.changeText(screen.getByTestId("item-problem-note"), "Item quebrado");
    await fireEvent.press(screen.getByTestId("item-problem-submit"));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Main"));

    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const stored = await AsyncStorage.getItem("catavento.pendingActions");
    expect(JSON.parse(stored)).toEqual([{ queueItemId: "item-1", type: "problem", note: "Item quebrado" }]);
  });
});
