import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { registerOnlineOperatorsSweepJob } from "../../src/modules/monitor/online-operators-sweep.job.js";

describe("registerOnlineOperatorsSweepJob", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    app = fastify({ logger: false });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it("chama sweepStale a cada intervalo configurado, e onStale pra cada operador que caiu", async () => {
    const sweepStale = vi.fn().mockReturnValueOnce(["op-1", "op-2"]).mockReturnValue([]);
    const onStale = vi.fn();
    registerOnlineOperatorsSweepJob(app, {
      intervalMs: 30000,
      timeoutMs: 180000,
      sweepStale,
      onStale,
    });

    await app.ready();
    expect(sweepStale).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30000);
    expect(sweepStale).toHaveBeenCalledWith(180000);
    expect(onStale).toHaveBeenCalledWith("op-1");
    expect(onStale).toHaveBeenCalledWith("op-2");
    expect(onStale).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30000);
    expect(sweepStale).toHaveBeenCalledTimes(2);
    expect(onStale).toHaveBeenCalledTimes(2);
  });

  it("registra o erro no logger quando sweepStale lança, sem derrubar o processo", async () => {
    const sweepStale = vi.fn().mockImplementation(() => {
      throw new Error("falha inesperada");
    });
    const logErrorSpy = vi.spyOn(app.log, "error");
    registerOnlineOperatorsSweepJob(app, {
      intervalMs: 30000,
      timeoutMs: 180000,
      sweepStale,
      onStale: vi.fn(),
    });

    await app.ready();
    await vi.advanceTimersByTimeAsync(30000);

    expect(logErrorSpy).toHaveBeenCalled();
  });

  it("para de rodar depois que o app fecha", async () => {
    const sweepStale = vi.fn().mockReturnValue([]);
    registerOnlineOperatorsSweepJob(app, {
      intervalMs: 30000,
      timeoutMs: 180000,
      sweepStale,
      onStale: vi.fn(),
    });

    await app.ready();
    await app.close();

    await vi.advanceTimersByTimeAsync(60000);
    expect(sweepStale).not.toHaveBeenCalled();
  });
});
