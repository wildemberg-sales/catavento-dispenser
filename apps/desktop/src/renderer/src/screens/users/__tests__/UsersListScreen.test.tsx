import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { UsersListScreen } from "../UsersListScreen";

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
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="users" element={<UsersListScreen />} />
          <Route path="users/new" element={<p>Novo usuário</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function user(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    username: "op1",
    role: "operator",
    displayName: "Operador Um",
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("UsersListScreen", () => {
  it("lista usuários com nome, papel e status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    expect(await screen.findByText("op1")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
  });

  it("filtro de papel refaz a listagem com o papel escolhido", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("role-filter")).toBeTruthy());
    fireEvent.change(screen.getByTestId("role-filter"), { target: { value: "admin" } });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("role=admin");
    });
  });

  it("filtro de status refaz a listagem com isActive", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("status-filter")).toBeTruthy());
    fireEvent.change(screen.getByTestId("status-filter"), { target: { value: "false" } });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("isActive=false");
    });
  });

  it("edita e salva o nome de exibição", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, user({ displayName: "Novo Nome" })))
      .mockResolvedValue(jsonResponse(200, { items: [user({ displayName: "Novo Nome" })], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.change(screen.getByTestId("displayname-input-user-1"), { target: { value: "Novo Nome" } });
    fireEvent.click(screen.getByTestId("save-displayname-user-1"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, options]) => String(u).endsWith("/admin/users/user-1") && (options as RequestInit)?.method === "PUT"
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ displayName: "Novo Nome" });
    });
  });

  it("muda o papel via select", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, user({ role: "admin" })))
      .mockResolvedValue(jsonResponse(200, { items: [user({ role: "admin" })], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.change(screen.getByTestId("role-select-user-1"), { target: { value: "admin" } });

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, options]) => String(u).endsWith("/admin/users/user-1") && (options as RequestInit)?.method === "PUT"
      );
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ role: "admin" });
    });
  });

  it("desativa e reativa um usuário", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, user({ isActive: false })))
      .mockResolvedValueOnce(jsonResponse(200, { items: [user({ isActive: false })], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(200, user({ isActive: true })))
      .mockResolvedValue(jsonResponse(200, { items: [user({ isActive: true })], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.click(screen.getByTestId("deactivate-user-1"));
    await screen.findByTestId("reactivate-user-1");

    fireEvent.click(screen.getByTestId("reactivate-user-1"));
    await screen.findByTestId("deactivate-user-1");
  });

  it("fluxo de redefinir senha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as unknown as Response);
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.click(screen.getByTestId("reset-password-user-1"));
    fireEvent.change(screen.getByTestId("reset-password-input-user-1"), { target: { value: "nova-senha-123" } });
    fireEvent.click(screen.getByTestId("reset-password-confirm-user-1"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/reset-password"));
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ newPassword: "nova-senha-123" });
    });
    await waitFor(() => expect(screen.queryByTestId("reset-password-input-user-1")).toBeNull());
  });

  it("mostra erro quando a redefinição de senha falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(jsonResponse(400, { error: "VALIDATION_ERROR", message: "Senha muito curta." }));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.click(screen.getByTestId("reset-password-user-1"));
    fireEvent.change(screen.getByTestId("reset-password-input-user-1"), { target: { value: "123" } });
    fireEvent.click(screen.getByTestId("reset-password-confirm-user-1"));

    expect(await screen.findByText("Senha muito curta.")).toBeTruthy();
  });

  it("botão de novo usuário navega pro cadastro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("new-user-button")).toBeTruthy());
    fireEvent.click(screen.getByTestId("new-user-button"));

    expect(await screen.findByText("Novo usuário")).toBeTruthy();
  });

  it("esconde o botão de desativar na própria linha do usuário logado", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: "access",
            refreshToken: "refresh",
            user: { id: "admin-1", username: "admin1", role: "admin", displayName: "Admin Um" },
          })
        );
      }
      if (url.includes("/admin/users")) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              user({ id: "admin-1", username: "admin1", role: "admin", displayName: "Admin Um" }),
              user({ id: "op-1", username: "op1" }),
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    const secureStoreWithToken = { ...secureStoreMock, get: vi.fn().mockResolvedValue("stored-refresh-token") };

    render(
      <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreWithToken}>
        <MemoryRouter initialEntries={["/users"]}>
          <Routes>
            <Route path="users" element={<UsersListScreen />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByTestId("deactivate-op-1");
    expect(screen.queryByTestId("deactivate-admin-1")).toBeNull();
  });

  it("clicar em Salvar sem editar o nome não chama o endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.click(screen.getByTestId("save-displayname-user-1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("mostra erro genérico quando a redefinição de senha falha por um motivo que não é erro de domínio", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [user()], total: 1, page: 1, pageSize: 20 }))
      .mockRejectedValueOnce(new Error("falha de rede"));
    renderScreen(fetchMock);

    await screen.findByText("op1");
    fireEvent.click(screen.getByTestId("reset-password-user-1"));
    fireEvent.change(screen.getByTestId("reset-password-input-user-1"), { target: { value: "nova-senha-123" } });
    fireEvent.click(screen.getByTestId("reset-password-confirm-user-1"));

    expect(await screen.findByText("Não foi possível redefinir a senha.")).toBeTruthy();
  });
});
