import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { UserForm } from "../UserForm";

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
      <MemoryRouter initialEntries={["/users/new"]}>
        <Routes>
          <Route path="users/new" element={<UserForm />} />
          <Route path="users" element={<p>Lista de usuários</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("UserForm", () => {
  it("cria um usuário e navega de volta pra lista", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: "user-novo",
        username: "novoop",
        role: "operator",
        displayName: "Novo Operador",
        isActive: true,
        createdAt: new Date().toISOString(),
      })
    );
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("user-username")).toBeTruthy());
    fireEvent.change(screen.getByTestId("user-username"), { target: { value: "novoop" } });
    fireEvent.change(screen.getByTestId("user-password"), { target: { value: "senha-do-novo-op" } });
    fireEvent.change(screen.getByTestId("user-displayname"), { target: { value: "Novo Operador" } });
    fireEvent.click(screen.getByTestId("user-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/users"));
      expect(call).toBeTruthy();
    });
    const [, options] = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/users"))!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body).toEqual({ username: "novoop", password: "senha-do-novo-op", displayName: "Novo Operador", role: "operator" });

    expect(await screen.findByText("Lista de usuários")).toBeTruthy();
  });

  it("muda o papel pra admin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { id: "user-novo", username: "novoadmin", role: "admin", displayName: "Novo Admin", isActive: true, createdAt: new Date().toISOString() })
    );
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("user-role")).toBeTruthy());
    fireEvent.change(screen.getByTestId("user-role"), { target: { value: "admin" } });
    fireEvent.change(screen.getByTestId("user-username"), { target: { value: "novoadmin" } });
    fireEvent.change(screen.getByTestId("user-password"), { target: { value: "senha-do-novo-admin" } });
    fireEvent.change(screen.getByTestId("user-displayname"), { target: { value: "Novo Admin" } });
    fireEvent.click(screen.getByTestId("user-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/admin/users"));
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.role).toBe("admin");
    });
  });

  it("mostra erro retornado pelo backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { error: "USERNAME_TAKEN", message: "Usuário já existe." }));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("user-submit")).toBeTruthy());
    fireEvent.change(screen.getByTestId("user-username"), { target: { value: "op1" } });
    fireEvent.change(screen.getByTestId("user-password"), { target: { value: "senha-123456" } });
    fireEvent.change(screen.getByTestId("user-displayname"), { target: { value: "Op Um" } });
    fireEvent.click(screen.getByTestId("user-submit"));

    expect(await screen.findByText("Usuário já existe.")).toBeTruthy();
  });

  it("mostra erro genérico quando a falha não é um erro de domínio", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede"));
    renderScreen(fetchMock);

    await waitFor(() => expect(screen.getByTestId("user-submit")).toBeTruthy());
    fireEvent.change(screen.getByTestId("user-username"), { target: { value: "op1" } });
    fireEvent.change(screen.getByTestId("user-password"), { target: { value: "senha-123456" } });
    fireEvent.change(screen.getByTestId("user-displayname"), { target: { value: "Op Um" } });
    fireEvent.click(screen.getByTestId("user-submit"));

    expect(await screen.findByText("Não foi possível criar o usuário.")).toBeTruthy();
  });
});
