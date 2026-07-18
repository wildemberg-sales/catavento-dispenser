import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { AuthProvider } from "../../auth/AuthContext";
import { MainScreen } from "../MainScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};

const inProgressItem = {
  id: "item-1",
  externalRef: "ML-1",
  source: "mercado_livre",
  productId: null,
  payload: { title: "Produto bruto" },
  priority: 0,
  status: "in_progress",
  createdAt: new Date().toISOString(),
  product: null,
};

function renderMainScreen(fetchMock: jest.Mock, navigation: { replace: jest.Mock }) {
  return render(
    <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MainScreen navigation={navigation as never} route={{} as never} />
    </AuthProvider>
  );
}

describe("MainScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
  });

  it("reidrata item em andamento e navega direto para a tela do item", async () => {
    const fetchMock = jest.fn((url: string) => {
      if (String(url).endsWith("/queue/current")) {
        return Promise.resolve(jsonResponse(200, { available: true, item: inProgressItem }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const navigation = { replace: jest.fn() };

    await renderMainScreen(fetchMock, navigation);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Item", { item: inProgressItem }));
  });

  it("sem item em andamento e fila vazia mostra estado de 'sem trabalho disponível'", async () => {
    const fetchMock = jest.fn((url: string) => {
      if (String(url).endsWith("/queue/current")) {
        return Promise.resolve(jsonResponse(200, { available: false }));
      }
      if (String(url).endsWith("/queue/next")) {
        return Promise.resolve(jsonResponse(200, { available: false }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const navigation = { replace: jest.fn() };

    await renderMainScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("main-next-button")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("main-next-button"));

    expect(await screen.findByText("Sem trabalho disponível no momento.")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("pegar próximo item navega para a tela do item quando disponível", async () => {
    const pendingItem = { ...inProgressItem, id: "item-2", status: "in_progress" };
    const fetchMock = jest.fn((url: string) => {
      if (String(url).endsWith("/queue/current")) {
        return Promise.resolve(jsonResponse(200, { available: false }));
      }
      if (String(url).endsWith("/queue/next")) {
        return Promise.resolve(jsonResponse(200, { available: true, item: pendingItem }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const navigation = { replace: jest.fn() };

    await renderMainScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("main-next-button")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("main-next-button"));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("Item", { item: pendingItem }));
  });
});
