import { describe, expect, it, vi } from "vitest";
import { usersService } from "../../src/modules/users/users.service.js";
import { UsernameTakenError } from "../../src/lib/errors.js";

describe("usersService.createUser — condição de corrida no unique constraint", () => {
  it("mapeia violação de unique constraint do banco para UsernameTakenError mesmo quando findByUsername não encontrou nada antes", async () => {
    const repo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockRejectedValue({ code: "23505" }),
    };
    const authRepo = { revokeAllForUser: vi.fn() };

    const service = usersService({ repo: repo as never, authRepo: authRepo as never });

    await expect(
      service.createUser({ username: "corrida", password: "senha12345", role: "operator", displayName: "X" })
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });
});
