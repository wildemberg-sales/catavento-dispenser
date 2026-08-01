import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { startTestDb, stopTestDb, truncateAll, type TestDbContext } from "../setup/testcontainer.js";
import { createUser } from "../setup/factories.js";
import { buildTestApp } from "../setup/build-test-app.js";
import { monitorBus } from "../../src/lib/monitor-bus.js";
import { onlineOperatorsStore } from "../../src/modules/monitor/online-operators.store.js";

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

  it("ecoa o header Access-Control-Allow-Origin na resposta real, não só no preflight — reply.hijack() pula o onSend do plugin de CORS, então precisa ser escrito à mão", async () => {
    await createUser(ctx.db, { username: "admin-cors", role: "admin" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "admin-cors");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const responseHeaders = await new Promise<Record<string, string | string[] | undefined>>((resolve, reject) => {
      const req = http.get(
        {
          host: "127.0.0.1",
          port,
          path: "/admin/stream",
          headers: { authorization: `Bearer ${token}`, origin: "http://localhost:5173" },
        },
        (res) => {
          resolve(res.headers);
          res.destroy();
        }
      );
      req.on("error", reject);
    });

    expect(responseHeaders["access-control-allow-origin"]).toBe("http://localhost:5173");
    await app.close();
  });

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

describe("GET /admin/monitor/online-operators", () => {
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

  it("devolve o snapshot de quem está online — é o que permite a tela de Monitor hidratar o estado ao abrir, sem depender só de eventos ao vivo", async () => {
    await createUser(ctx.db, { username: "admin1", role: "admin" });
    const operator = await createUser(ctx.db, { username: "op-snapshot", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const adminToken = await loginAs(app, "admin1");
    await loginAs(app, "op-snapshot");

    const response = await app.inject({
      method: "GET",
      url: "/admin/monitor/online-operators",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [{ operatorId: operator.id, displayName: operator.displayName }] });
    await app.close();
  });

  it("não inclui operadores que já deslogaram", async () => {
    await createUser(ctx.db, { username: "admin2", role: "admin" });
    await createUser(ctx.db, { username: "op-logged-out", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const adminToken = await loginAs(app, "admin2");
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "op-logged-out", password: "senha-de-teste-123" },
    });
    const { refreshToken } = loginResponse.json();

    await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken } });

    const response = await app.inject({
      method: "GET",
      url: "/admin/monitor/online-operators",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.json()).toEqual({ items: [] });
    await app.close();
  });

  it("retorna 403 para operador", async () => {
    await createUser(ctx.db, { username: "op-tentando-ver", role: "operator" });
    const app = await buildTestApp(ctx.db);
    const token = await loginAs(app, "op-tentando-ver");

    const response = await app.inject({
      method: "GET",
      url: "/admin/monitor/online-operators",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
