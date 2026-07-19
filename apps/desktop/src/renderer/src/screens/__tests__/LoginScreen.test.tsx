import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider } from "../../auth/AuthContext";
import { LoginScreen } from "../LoginScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function renderLoginScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <LoginScreen />
    </AuthProvider>
  );
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStoreMock.get.mockResolvedValue(null);
  });

  it("mostra erro de validação quando usuário ou senha estão vazios", async () => {
    const fetchMock = vi.fn();

    renderLoginScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    fireEvent.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Usuário e senha são obrigatórios.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede (erro que não é ApiClientError) mostra mensagem genérica", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network request failed"));

    renderLoginScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    fireEvent.change(screen.getByTestId("login-username"), { target: { value: "admin1" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Não foi possível entrar.")).toBeTruthy();
  });

  it("credenciais inválidas mostram mensagem de erro", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos." }));

    renderLoginScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    fireEvent.change(screen.getByTestId("login-username"), { target: { value: "admin1" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "senhaerrada" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Usuário ou senha inválidos.")).toBeTruthy();
  });

  it("login de operador mostra mensagem de app restrito a administradores", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "operador1", role: "operator", displayName: "Operador 1" },
      })
    );

    renderLoginScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    fireEvent.change(screen.getByTestId("login-username"), { target: { value: "operador1" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Esta aplicação é restrita a administradores.")).toBeTruthy();
  });

  it("login de admin com sucesso não mostra erro e persiste a sessão (a troca de tela é reativa ao estado de autenticação)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
      })
    );

    renderLoginScreen(fetchMock);
    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());

    fireEvent.change(screen.getByTestId("login-username"), { target: { value: "admin1" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() => expect(secureStoreMock.set).toHaveBeenCalledWith("catavento.refreshToken", "refresh-1"));
  });
});
