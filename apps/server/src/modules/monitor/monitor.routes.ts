import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { monitorBus } from "../../lib/monitor-bus.js";
import { onlineOperatorsStore } from "./online-operators.store.js";
import { parseAllowedOrigins, resolveCorsOrigin } from "../../lib/cors-origins.js";

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
      // reply.hijack() tira o Fastify do controle da resposta — o header de
      // CORS que o plugin normalmente injeta via onSend (Access-Control-
      // Allow-Origin) nunca chega a ser escrito aqui, então precisa ser
      // replicado manualmente. Sem isso, o navegador aceita o preflight
      // (OPTIONS, que não passa por essa rota) mas rejeita a resposta real
      // sempre que a origem do app não é idêntica à da API — é exatamente o
      // caso do renderer do Electron em modo dev, servido pelo Vite em
      // http://localhost:5173 batendo em http://localhost:3000 — o fetch()
      // falha com "blocked by CORS policy" e o cliente entra num loop de
      // reconexão que nunca se estabiliza. Usa a mesma allowlist do plugin
      // de CORS principal (CORS_ALLOWED_ORIGINS) — sem isso, essa rota
      // continuaria refletindo qualquer origem mesmo depois de restringir
      // o resto da API.
      const headers: Record<string, string> = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      };
      const allowedOrigin = resolveCorsOrigin(req.headers.origin, parseAllowedOrigins(app.config.CORS_ALLOWED_ORIGINS));
      if (allowedOrigin) {
        headers["Access-Control-Allow-Origin"] = allowedOrigin;
        headers.Vary = "Origin";
      }
      reply.raw.writeHead(200, headers);
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
