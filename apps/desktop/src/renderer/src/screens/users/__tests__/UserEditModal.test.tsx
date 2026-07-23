import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserEditModal } from "../UserEditModal";
import { ApiClientError } from "../../../api/client";

const user = {
  id: "user-1",
  username: "op1",
  role: "operator" as const,
  displayName: "Operador Um",
  isActive: true,
  createdAt: new Date().toISOString(),
};

function createUsersApiMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(user),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("UserEditModal", () => {
  it("pré-preenche nome e papel com os dados do usuário", () => {
    render(<UserEditModal user={user} usersApi={createUsersApiMock()} onClose={() => {}} onSuccess={() => {}} />);

    expect(screen.getByTestId("edit-user-displayname")).toHaveValue("Operador Um");
    expect(screen.getByTestId("edit-user-role")).toHaveValue("operator");
    expect(screen.getByTestId("edit-user-password")).toHaveValue("");
  });

  it("salva nome e papel sem mexer na senha quando o campo de senha fica vazio", async () => {
    const usersApi = createUsersApiMock();
    const onSuccess = vi.fn();
    render(<UserEditModal user={user} usersApi={usersApi} onClose={() => {}} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByTestId("edit-user-displayname"), { target: { value: "Novo Nome" } });
    fireEvent.change(screen.getByTestId("edit-user-role"), { target: { value: "admin" } });
    fireEvent.click(screen.getByTestId("edit-user-submit"));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith("user-1", { displayName: "Novo Nome", role: "admin" });
    });
    expect(usersApi.resetPassword).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("também redefine a senha quando o campo é preenchido", async () => {
    const usersApi = createUsersApiMock();
    const onSuccess = vi.fn();
    render(<UserEditModal user={user} usersApi={usersApi} onClose={() => {}} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByTestId("edit-user-password"), { target: { value: "nova-senha-123" } });
    fireEvent.click(screen.getByTestId("edit-user-submit"));

    await waitFor(() => {
      expect(usersApi.resetPassword).toHaveBeenCalledWith("user-1", { newPassword: "nova-senha-123" });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("mostra o erro de domínio retornado pelo backend", async () => {
    const usersApi = createUsersApiMock({
      update: vi.fn().mockRejectedValue(new ApiClientError("Nome inválido.", "VALIDATION_ERROR", 400)),
    });
    render(<UserEditModal user={user} usersApi={usersApi} onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.click(screen.getByTestId("edit-user-submit"));

    expect(await screen.findByText("Nome inválido.")).toBeTruthy();
  });

  it("mostra um erro genérico quando a falha não é um erro de domínio", async () => {
    const usersApi = createUsersApiMock({ update: vi.fn().mockRejectedValue(new Error("falha de rede")) });
    render(<UserEditModal user={user} usersApi={usersApi} onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.click(screen.getByTestId("edit-user-submit"));

    expect(await screen.findByText("Não foi possível salvar as alterações.")).toBeTruthy();
  });

  it("chama onClose ao clicar em cancelar", () => {
    const onClose = vi.fn();
    render(<UserEditModal user={user} usersApi={createUsersApiMock()} onClose={onClose} onSuccess={() => {}} />);

    fireEvent.click(screen.getByTestId("edit-user-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
