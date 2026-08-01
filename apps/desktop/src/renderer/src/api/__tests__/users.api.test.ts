import { describe, expect, it, vi } from "vitest";
import { createUsersApi } from "../users.api";
import type { ApiClient } from "../client";

// UserEditModal.test.tsx testa o fluxo de reset de senha com usersApi
// inteiramente mockado (nunca chama a fábrica de verdade) — o corpo real de
// resetPassword() nunca era exercitado por nenhum teste.
describe("createUsersApi", () => {
  it("resetPassword chama o endpoint certo com method POST e o corpo esperado", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const client = { request } as unknown as ApiClient;
    const usersApi = createUsersApi(client);

    await usersApi.resetPassword("user-1", { newPassword: "nova-senha-123" });

    expect(request).toHaveBeenCalledWith("/admin/users/user-1/reset-password", {
      method: "POST",
      body: { newPassword: "nova-senha-123" },
    });
  });
});
