import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/modules/auth/password.js";

describe("password", () => {
  it("hashPassword retorna um hash argon2id diferente do input", async () => {
    const hash = await hashPassword("minhaSenha123");
    expect(hash).not.toBe("minhaSenha123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("verifyPassword retorna true para a senha correta", async () => {
    const hash = await hashPassword("minhaSenha123");
    await expect(verifyPassword(hash, "minhaSenha123")).resolves.toBe(true);
  });

  it("verifyPassword retorna false para a senha errada", async () => {
    const hash = await hashPassword("minhaSenha123");
    await expect(verifyPassword(hash, "outraSenha")).resolves.toBe(false);
  });
});
