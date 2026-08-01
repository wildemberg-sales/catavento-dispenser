import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { onlineOperatorsStore } from "../../src/modules/monitor/online-operators.store.js";

describe("POST /queue/heartbeat", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await startTestDb();
  }, 60000);

  afterAll(async () => {
    await stopTestDb(ctx);
  });

  beforeEach(async () => {
    await truncateAll(ctx.db);
    onlineOperatorsStore.clear();
  });

  async function loginAs(app: Awaited<ReturnType<typeof buildTestApp>>, username: string) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "senha-de-teste-123" },
    });
    return response.json().accessToken as string;
  }

  it("marca o operador como online no store (self-heal, mesmo que já não estivesse rastreado)", async () => {
    const operator = await createUser(ctx.db, { username: "op-heartbeat", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-heartbeat");
    // simula o store tendo perdido o estado (ex.: restart do servidor) —
    // o heartbeat deve se autocurar mesmo assim.
    onlineOperatorsStore.clear();

    const response = await app.inject({
      method: "POST",
      url: "/queue/heartbeat",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(204);
    expect(onlineOperatorsStore.listOnline()).toEqual([
      { operatorId: operator.id, displayName: operator.displayName },
    ]);
    await app.close();
  });

  it("retorna 401 sem token", async () => {
    const app = await buildTestApp(ctx.db);
    const response = await app.inject({ method: "POST", url: "/queue/heartbeat" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 403 para admin", async () => {
    await createUser(ctx.db, { username: "admin-heartbeat", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-heartbeat");

    const response = await app.inject({
      method: "POST",
      url: "/queue/heartbeat",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
