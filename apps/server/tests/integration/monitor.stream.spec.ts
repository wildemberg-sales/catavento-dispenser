import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { monitorBus } from "../../src/lib/monitor-bus.js";

describe("GET /admin/stream (SSE)", () => {
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

  async function loginAs(app: Awaited<ReturnType<typeof buildTestApp>>, username: string) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "senha-de-teste-123" },
    });
    return response.json().accessToken as string;
  }

  it("recebe eventos publicados no monitorBus formatados como SSE", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin1");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const chunks: string[] = [];
    const received = new Promise<void>((resolve, reject) => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/admin/stream", headers: { authorization: `Bearer ${token}` } },
        (res) => {
          res.on("data", (chunk) => {
            chunks.push(chunk.toString());
            if (chunks.join("").includes("item_assigned")) resolve();
          });
          res.on("error", reject);
        }
      );
      req.on("error", reject);
    });

    // dá tempo do listener SSE se registrar antes de publicar
    await new Promise((resolve) => setTimeout(resolve, 100));
    monitorBus.publish({
      type: "item_assigned",
      payload: { queueItemId: "item1", operatorId: "op1", queueSize: 3 },
    });

    await received;
    const body = chunks.join("");
    expect(body).toContain("event: item_assigned");
    expect(body).toContain('"queueItemId":"item1"');
    await app.close();
  }, 10000);

  it("retorna 401 sem token, antes de fazer upgrade para stream", async () => {
    const app = await buildTestApp(ctx.db);
    const response = await app.inject({ method: "GET", url: "/admin/stream" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op1", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op1");
    const response = await app.inject({
      method: "GET",
      url: "/admin/stream",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
