import { describe, expect, it, vi } from "vitest";
import { withMonitorEvents } from "../../src/modules/monitor/instrumented-queue-service.js";
import { MonitorBus } from "../../src/lib/monitor-bus.js";

describe("withMonitorEvents", () => {
  it("dequeueNext publica item_assigned com o queueSize atual quando um item é atribuído", async () => {
    const mockService = {
      dequeueNext: vi.fn().mockResolvedValue({
        available: true,
        item: { id: "item1", product: null } as never,
      }),
    } as never;
    const bus = new MonitorBus();
    const publishSpy = vi.spyOn(bus, "publish");
    const mockRepo = { countPending: vi.fn().mockResolvedValue(7) } as never;

    const wrapped = withMonitorEvents(mockService, bus, mockRepo);
    const result = await wrapped.dequeueNext("op1");

    expect(result).toEqual({ available: true, item: { id: "item1", product: null } });
    expect(publishSpy).toHaveBeenCalledWith({
      type: "item_assigned",
      payload: { queueItemId: "item1", operatorId: "op1", queueSize: 7 },
    });
  });

  it("dequeueNext NÃO publica evento quando a fila está vazia", async () => {
    const mockService = { dequeueNext: vi.fn().mockResolvedValue({ available: false }) } as never;
    const bus = new MonitorBus();
    const publishSpy = vi.spyOn(bus, "publish");
    const mockRepo = { countPending: vi.fn() } as never;

    const wrapped = withMonitorEvents(mockService, bus, mockRepo);
    await wrapped.dequeueNext("op1");

    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("completeItem publica item_completed com outcome completed", async () => {
    const mockService = { completeItem: vi.fn().mockResolvedValue(undefined) } as never;
    const bus = new MonitorBus();
    const publishSpy = vi.spyOn(bus, "publish");

    const wrapped = withMonitorEvents(mockService, bus, {} as never);
    await wrapped.completeItem("op1", "item1");

    expect(publishSpy).toHaveBeenCalledWith({
      type: "item_completed",
      payload: { queueItemId: "item1", operatorId: "op1", outcome: "completed" },
    });
  });
});
