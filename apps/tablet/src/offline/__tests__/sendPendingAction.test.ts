import { createPendingActionSender } from "../sendPendingAction";

describe("createPendingActionSender", () => {
  it("envia uma ação de conclusão via queueApi.complete", async () => {
    const queueApi = { complete: jest.fn().mockResolvedValue(undefined), problem: jest.fn() };
    const send = createPendingActionSender(queueApi as never);

    await send({ queueItemId: "item-1", type: "complete" });

    expect(queueApi.complete).toHaveBeenCalledWith("item-1");
    expect(queueApi.problem).not.toHaveBeenCalled();
  });

  it("envia uma ação de problema via queueApi.problem com a nota", async () => {
    const queueApi = { complete: jest.fn(), problem: jest.fn().mockResolvedValue(undefined) };
    const send = createPendingActionSender(queueApi as never);

    await send({ queueItemId: "item-1", type: "problem", note: "quebrado" });

    expect(queueApi.problem).toHaveBeenCalledWith("item-1", "quebrado");
    expect(queueApi.complete).not.toHaveBeenCalled();
  });

  it("envia nota vazia quando a ação de problema não tem nota", async () => {
    const queueApi = { complete: jest.fn(), problem: jest.fn().mockResolvedValue(undefined) };
    const send = createPendingActionSender(queueApi as never);

    await send({ queueItemId: "item-1", type: "problem" });

    expect(queueApi.problem).toHaveBeenCalledWith("item-1", "");
  });
});
