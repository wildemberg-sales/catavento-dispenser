import type { FastifyInstance } from "fastify";

// Mesmo padrão do abandonment.job.ts — roda periodicamente depois que o app
// fica pronto, pra desde já cobrir o caso do app do operador cair/perder
// rede sem passar pelo /auth/logout: sem heartbeat recente, o operador é
// considerado offline mesmo sem um logout explícito (ver online-operators.store.ts).
export function registerOnlineOperatorsSweepJob(
  app: FastifyInstance,
  opts: {
    intervalMs: number;
    timeoutMs: number;
    sweepStale: (timeoutMs: number) => string[] | Promise<string[]>;
    onStale: (operatorId: string) => void;
  }
) {
  let timer: NodeJS.Timeout | undefined;

  app.addHook("onReady", async () => {
    timer = setInterval(() => {
      (async () => {
        const staleOperatorIds = await opts.sweepStale(opts.timeoutMs);
        for (const operatorId of staleOperatorIds) {
          opts.onStale(operatorId);
        }
      })().catch((err) => app.log.error(err));
    }, opts.intervalMs);
  });

  app.addHook("onClose", async () => {
    if (timer) {
      clearInterval(timer);
    }
  });
}
