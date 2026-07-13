import { describe, expect, it } from "vitest";
import {
  listUsersQuerySchema,
  resetPasswordInputSchema,
  updateUserInputSchema,
} from "../src/users/schemas.js";

describe("users schemas (admin)", () => {
  it("updateUserInputSchema rejeita objeto vazio", () => {
    expect(updateUserInputSchema.safeParse({}).success).toBe(false);
  });

  it("updateUserInputSchema aceita atualização parcial de um campo", () => {
    expect(updateUserInputSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateUserInputSchema.safeParse({ displayName: "Novo Nome" }).success).toBe(true);
  });

  it("resetPasswordInputSchema rejeita senha curta", () => {
    expect(resetPasswordInputSchema.safeParse({ newPassword: "123" }).success).toBe(false);
  });

  it("resetPasswordInputSchema aceita senha com 8+ caracteres", () => {
    expect(resetPasswordInputSchema.safeParse({ newPassword: "12345678" }).success).toBe(true);
  });

  it("listUsersQuerySchema aplica defaults de paginação e aceita filtros opcionais", () => {
    const result = listUsersQuerySchema.safeParse({ role: "operator" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
    expect(listUsersQuerySchema.safeParse({ isActive: "true" }).success).toBe(true);
  });

  it("listUsersQuerySchema converte a string 'false' da query para o booleano false (não truthy)", () => {
    const result = listUsersQuerySchema.safeParse({ isActive: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });
});
