import { describe, expect, it, vi } from "vitest";
import { MonitorBus } from "../../src/lib/monitor-bus.js";

describe("MonitorBus", () => {
  it("subscribe recebe eventos publicados", () => {
    const bus = new MonitorBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.publish({ type: "queue_size_changed", payload: { queueSize: 5 } });

    expect(listener).toHaveBeenCalledWith({ type: "queue_size_changed", payload: { queueSize: 5 } });
  });

  it("unsubscribe (retorno de subscribe) impede recebimento de eventos futuros", () => {
    const bus = new MonitorBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    unsubscribe();

    bus.publish({ type: "queue_size_changed", payload: { queueSize: 1 } });

    expect(listener).not.toHaveBeenCalled();
  });

  it("suporta múltiplos subscribers independentes", () => {
    const bus = new MonitorBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.subscribe(listener1);
    bus.subscribe(listener2);

    bus.publish({ type: "operator_online", payload: { operatorId: "op1" } });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
