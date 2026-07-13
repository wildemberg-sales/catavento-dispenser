import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { monitorBus } from "../../lib/monitor-bus.js";

const HEARTBEAT_INTERVAL_MS = 25000;

export default async function monitorRoutes(app: FastifyInstance) {
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
