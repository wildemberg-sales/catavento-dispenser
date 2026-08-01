import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { monitorBus } from "../../lib/monitor-bus.js";
import { onlineOperatorsStore } from "./online-operators.store.js";

const HEARTBEAT_INTERVAL_MS = 25000;

export default async function monitorRoutes(app: FastifyInstance) {
  // Snapshot do estado atual — sem isso, um cliente do Monitor só sabia quem
  // estava online a partir dos eventos ao vivo recebidos DEPOIS de abrir a
  // tela (ou de reconectar o SSE), então operadores que já estavam online
  // antes disso apareciam como offline até o próximo evento.
  app.get(
    "/monitor/online-operators",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (_req, reply) => {
      return reply.status(200).send({ items: onlineOperatorsStore.listOnline() });
    }
  );

  app.get(
    "/stream",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      reply.raw.write(": connected\n\n");

      const unsubscribe = monitorBus.subscribe((event) => {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(": ping\n\n");
      }, HEARTBEAT_INTERVAL_MS);

      req.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }
  );
}
