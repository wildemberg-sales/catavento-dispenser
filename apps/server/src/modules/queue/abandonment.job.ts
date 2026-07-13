import type { FastifyInstance } from "fastify";

export function registerAbandonmentJob(
  app: FastifyInstance,
  opts: {
    intervalMs: number;
    timeoutMinutes: number;
    abandonStale: (timeoutMinutes: number) => Promise<number>;
  }
) {
  let timer: NodeJS.Timeout | undefined;

  app.addHook("onReady", async () => {
    timer = setInterval(() => {
      opts.abandonStale(opts.timeoutMinutes).catch((err) => app.log.error(err));
    }, opts.intervalMs);
  });

  app.addHook("onClose", async () => {
    if (timer) {
      clearInterval(timer);
    }
  });
}
