import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { registerAbandonmentJob } from "../../src/modules/queue/abandonment.job.js";

describe("registerAbandonmentJob", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    app = fastify({ logger: false });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it("chama abandonStale a cada intervalo configurado, após o app ficar pronto", async () => {
    const abandonStale = vi.fn().mockResolvedValue(0);
    registerAbandonmentJob(app, {
      intervalMs: 60000,
      timeoutMinutes: 15,
      abandonStale,
    });

    await app.ready();
    expect(abandonStale).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60000);
    expect(abandonStale).toHaveBeenCalledWith(15);
    expect(abandonStale).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);
    expect(abandonStale).toHaveBeenCalledTimes(2);
  });

  it("registra o erro no logger quando abandonStale rejeita, sem derrubar o processo", async () => {
    const abandonStale = vi.fn().mockRejectedValue(new Error("falha de conexão"));
    const logErrorSpy = vi.spyOn(app.log, "error");
    registerAbandonmentJob(app, {
      intervalMs: 60000,
      timeoutMinutes: 15,
      abandonStale,
    });

    await app.ready();
    await vi.advanceTimersByTimeAsync(60000);

    expect(logErrorSpy).toHaveBeenCalled();
  });

  it("para de chamar abandonStale depois que o app fecha", async () => {
    const abandonStale = vi.fn().mockResolvedValue(0);
    registerAbandonmentJob(app, {
      intervalMs: 60000,
      timeoutMinutes: 15,
      abandonStale,
    });

    await app.ready();
    await app.close();

    await vi.advanceTimersByTimeAsync(120000);
    expect(abandonStale).not.toHaveBeenCalled();
  });
});
