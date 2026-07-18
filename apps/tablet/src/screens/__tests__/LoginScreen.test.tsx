import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { AuthProvider } from "../../auth/AuthContext";
import { LoginScreen } from "../LoginScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};

function renderLoginScreen(fetchMock: jest.Mock, navigation: { replace: jest.Mock }) {
  return render(
    <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <LoginScreen navigation={navigation as never} route={{} as never} />
    </AuthProvider>
  );
}

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
  });

  it("mostra erro de validação quando usuário ou senha estão vazios", async () => {
    const fetchMock = jest.fn();
    const navigation = { replace: jest.fn() };

    await renderLoginScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Usuário e senha são obrigatórios.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("falha de rede (erro que não é ApiClientError) mostra mensagem genérica", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const navigation = { replace: jest.fn() };

    await renderLoginScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId("login-username"), "op1");
    await fireEvent.changeText(screen.getByTestId("login-password"), "senha123");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Não foi possível entrar.")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("credenciais inválidas mostram mensagem de erro e não navegam", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(401, { error: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos." })
    );
    const navigation = { replace: jest.fn() };

    await renderLoginScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId("login-username"), "op1");
    await fireEvent.changeText(screen.getByTestId("login-password"), "senhaerrada");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Usuário ou senha inválidos.")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("login com sucesso persiste a sessão sem mostrar erro (a troca de tela é reativa ao estado de autenticação, feita pelo RootNavigator)", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
      })
    );
    const navigation = { replace: jest.fn() };

    await renderLoginScreen(fetchMock, navigation);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId("login-username"), "op1");
    await fireEvent.changeText(screen.getByTestId("login-password"), "senha123");
    await fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1")
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
