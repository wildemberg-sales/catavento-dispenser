import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../AuthContext";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function TestConsumer() {
  const { user, isLoading, login, logout, apiClient } = useAuth();
  const [apiResult, setApiResult] = React.useState("idle");
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="user">{user ? user.displayName : "sem-usuario"}</Text>
      <Text testID="api-result">{apiResult}</Text>
      <Text testID="login-btn" onPress={() => login("op1", "senha123")}>
        entrar
      </Text>
      <Text testID="logout-btn" onPress={() => logout()}>
        sair
      </Text>
      <Text
        testID="call-api-btn"
        onPress={() => apiClient.request("/queue/current").then(() => setApiResult("ok"), () => setApiResult("erro"))}
      >
        chamar
      </Text>
    </>
  );
}

function BareConsumer() {
  useAuth();
  return null;
}

const secureStoreMock = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
  });

  it("login bem-sucedido persiste o refresh token e atualiza o usuário", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
      })
    );

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("login-btn"));

    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("Operador 1"));
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1");
  });

  it("restaura a sessão a partir do refresh token salvo, ao montar", async () => {
    secureStoreMock.getItemAsync.mockResolvedValue("refresh-salvo");
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "novo-access",
        refreshToken: "novo-refresh",
        user: { id: "2", username: "op2", role: "operator", displayName: "Operador Restaurado" },
      })
    );

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("Operador Restaurado"));
  });

  it("refresh token salvo inválido não trava o app — usuário permanece deslogado", async () => {
    secureStoreMock.getItemAsync.mockResolvedValue("refresh-invalido");
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "x" }));

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    expect(screen.getByTestId("user").props.children).toBe("sem-usuario");
  });

  it("logout limpa o usuário e remove o refresh token persistido", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(204, {}));

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("Operador 1"));

    await fireEvent.press(screen.getByTestId("logout-btn"));
    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("sem-usuario"));
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith("catavento.refreshToken");
  });

  it("logout sem sessão ativa não chama o endpoint de logout, apenas limpa o estado local", async () => {
    const fetchMock = jest.fn();

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("logout-btn"));

    await waitFor(() => expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith("catavento.refreshToken"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa o expo-secure-store real por padrão quando nenhum é informado", async () => {
    const expoSecureStore = require("expo-secure-store");
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
      })
    );

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("login-btn"));

    await waitFor(() =>
      expect(expoSecureStore.setItemAsync).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1")
    );
  });

  it("useAuth lança erro quando usado fora do AuthProvider", async () => {
    await expect(render(<BareConsumer />)).rejects.toThrow("useAuth deve ser usado dentro de um AuthProvider");
  });

  it("uma chamada autenticada expirada renova o token automaticamente e repete a requisição", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "access-2", refreshToken: "refresh-2", user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" } })
      )
      .mockResolvedValueOnce(jsonResponse(200, { available: false }));

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("Operador 1"));

    await fireEvent.press(screen.getByTestId("call-api-btn"));

    await waitFor(() => expect(screen.getByTestId("api-result").props.children).toBe("ok"));
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith("catavento.refreshToken", "refresh-2");
  });

  it("se a renovação automática falhar durante uma chamada autenticada, desloga o usuário", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "op1", role: "operator", displayName: "Operador 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "invalido" }));

    await render(
      <AuthProvider baseUrl="http://10.0.2.2:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("false"));
    await fireEvent.press(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("Operador 1"));

    await fireEvent.press(screen.getByTestId("call-api-btn"));

    await waitFor(() => expect(screen.getByTestId("api-result").props.children).toBe("erro"));
    await waitFor(() => expect(screen.getByTestId("user").props.children).toBe("sem-usuario"));
  });
});
