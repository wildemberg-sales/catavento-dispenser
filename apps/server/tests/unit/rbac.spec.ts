import { describe, expect, it } from "vitest";
import { requireRole } from "../../src/modules/auth/rbac.js";

function makeRequest(role?: "admin" | "operator") {
  return {
    authUser: role ? { id: "u1", username: "test", role } : undefined,
    server: {
      httpErrors: {
        forbidden: (msg: string) => new Error(msg),
      },
    },
  } as any;
}

describe("requireRole", () => {
  it("rejeita quando o usuário não tem o papel exigido", async () => {
    const hook = requireRole("admin");
    await expect(hook(makeRequest("operator"), {} as any)).rejects.toThrow();
  });

  it("aceita quando o usuário tem o papel exigido", async () => {
    const hook = requireRole("admin");
    await expect(hook(makeRequest("admin"), {} as any)).resolves.not.toThrow();
  });

  it("aceita múltiplos papéis permitidos", async () => {
    const hook = requireRole("admin", "operator");
    await expect(hook(makeRequest("operator"), {} as any)).resolves.not.toThrow();
    await expect(hook(makeRequest("admin"), {} as any)).resolves.not.toThrow();
  });

  it("rejeita quando não há usuário autenticado no request", async () => {
    const hook = requireRole("admin");
    await expect(hook(makeRequest(undefined), {} as any)).rejects.toThrow();
  });
});
