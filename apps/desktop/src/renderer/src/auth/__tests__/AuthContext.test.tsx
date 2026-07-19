import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function TestConsumer() {
  const { user, isLoading, login, logout, apiClient } = useAuth();
  const [apiResult, setApiResult] = React.useState("idle");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  return (
    <>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.displayName : "sem-usuario"}</span>
      <span data-testid="api-result">{apiResult}</span>
      <span data-testid="login-error">{loginError ?? ""}</span>
      <button
        data-testid="login-btn"
        onClick={() =>
          login("admin1", "senha123")
            .then(() => setLoginError(null))
            .catch((err) => setLoginError(err instanceof Error ? err.message : "erro"))
        }
      >
        entrar
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        sair
      </button>
      <button
        data-testid="call-api-btn"
        onClick={() => apiClient.request("/admin/queue/").then(() => setApiResult("ok"), () => setApiResult("erro"))}
      >
        chamar
      </button>
    </>
  );
}

function BareConsumer() {
  useAuth();
  return null;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStoreMock.get.mockResolvedValue(null);
  });

  it("login bem-sucedido persiste o refresh token e atualiza o usuário", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
      })
    );

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Admin 1"));
    expect(secureStoreMock.set).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1");
  });

  it("rejeita login de usuário com papel diferente de admin (app restrito à gerência)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "operador1", role: "operator", displayName: "Operador 1" },
      })
    );

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() =>
      expect(screen.getByTestId("login-error").textContent).toBe("Esta aplicação é restrita a administradores.")
    );
    expect(screen.getByTestId("user").textContent).toBe("sem-usuario");
    expect(secureStoreMock.set).not.toHaveBeenCalled();
  });

  it("restaura a sessão a partir do refresh token salvo, ao montar", async () => {
    secureStoreMock.get.mockResolvedValue("refresh-salvo");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "novo-access",
        refreshToken: "novo-refresh",
        user: { id: "2", username: "admin2", role: "admin", displayName: "Admin Restaurado" },
      })
    );

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Admin Restaurado"));
  });

  it("refresh token salvo inválido não trava o app — usuário permanece deslogado", async () => {
    secureStoreMock.get.mockResolvedValue("refresh-invalido");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "x" }));

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("sem-usuario");
  });

  it("logout limpa o usuário e remove o refresh token persistido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(204, {}));

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Admin 1"));

    fireEvent.click(screen.getByTestId("logout-btn"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("sem-usuario"));
    expect(secureStoreMock.delete).toHaveBeenCalledWith("catavento.refreshToken");
  });

  it("logout sem sessão ativa não chama o endpoint de logout, apenas limpa o estado local", async () => {
    const fetchMock = vi.fn();

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("logout-btn"));

    await waitFor(() => expect(secureStoreMock.delete).toHaveBeenCalledWith("catavento.refreshToken"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa o secureStore exposto pelo preload (window.catavento) por padrão quando nenhum é informado", async () => {
    const bridgeSecureStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    window.catavento = { secureStore: bridgeSecureStore };

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
      })
    );

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() => expect(bridgeSecureStore.set).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1"));
  });

  it("usa o fetch global quando fetchImpl não é informado", async () => {
    window.catavento = { secureStore: secureStoreMock };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { available: false }));

    try {
      render(
        <AuthProvider baseUrl="http://localhost:3000" secureStore={secureStoreMock}>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("useAuth lança erro quando usado fora do AuthProvider", () => {
    expect(() => render(<BareConsumer />)).toThrow("useAuth deve ser usado dentro de um AuthProvider");
  });

  it("uma chamada autenticada expirada renova o token automaticamente e repete a requisição", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-2",
          refreshToken: "refresh-2",
          user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Admin 1"));

    fireEvent.click(screen.getByTestId("call-api-btn"));

    await waitFor(() => expect(screen.getByTestId("api-result").textContent).toBe("ok"));
    expect(secureStoreMock.set).toHaveBeenCalledWith("catavento.refreshToken", "refresh-2");
  });

  it("se a renovação automática falhar durante uma chamada autenticada, desloga o usuário", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "access-1",
          refreshToken: "refresh-1",
          user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "invalido" }));

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    fireEvent.click(screen.getByTestId("login-btn"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Admin 1"));

    fireEvent.click(screen.getByTestId("call-api-btn"));

    await waitFor(() => expect(screen.getByTestId("api-result").textContent).toBe("erro"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("sem-usuario"));
  });
});
