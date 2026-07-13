import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { usersRepository } from "../../src/modules/users/users.repository.js";

describe("usersRepository", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await startTestDb();
  }, 60000);

  afterAll(async () => {
    await stopTestDb(ctx);
  });

  beforeEach(async () => {
    await truncateAll(ctx.db);
  });

  it("findByUsername retorna o usuário quando existe", async () => {
    await createUser(ctx.db, { username: "existe" });
    const repo = usersRepository(ctx.db);
    const user = await repo.findByUsername("existe");
    expect(user?.username).toBe("existe");
  });

  it("findByUsername retorna null quando não existe", async () => {
    const repo = usersRepository(ctx.db);
    const user = await repo.findByUsername("nao-existe");
    expect(user).toBeNull();
  });

  it("findById retorna o usuário quando existe", async () => {
    const created = await createUser(ctx.db, { username: "porid" });
    const repo = usersRepository(ctx.db);
    const user = await repo.findById(created.id);
    expect(user?.id).toBe(created.id);
  });

  it("findById retorna null quando o id não existe", async () => {
    const repo = usersRepository(ctx.db);
    const user = await repo.findById("00000000-0000-4000-8000-000000000000");
    expect(user).toBeNull();
  });
});
