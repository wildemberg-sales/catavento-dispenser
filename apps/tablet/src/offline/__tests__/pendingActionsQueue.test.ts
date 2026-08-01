import { createPendingActionsQueue } from "../pendingActionsQueue";
import { ApiClientError } from "../../api/client";

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe("createPendingActionsQueue", () => {
  it("enfileira uma ação e ela aparece na lista pendente", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });

    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    const pending = await queue.list();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ queueItemId: "item-1", type: "complete" });
  });

  it("idempotência: enfileirar a mesma ação (mesmo queueItemId+type) duas vezes não duplica", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });

    await queue.enqueue({ queueItemId: "item-1", type: "complete" });
    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    expect(await queue.list()).toHaveLength(1);
  });

  it("drena a fila com sucesso: ação enviada com sucesso é removida", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });
    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    const sender = jest.fn().mockResolvedValue(undefined);
    await queue.drain(sender);

    expect(sender).toHaveBeenCalledWith({ queueItemId: "item-1", type: "complete", note: undefined });
    expect(await queue.list()).toHaveLength(0);
  });

  it("mantém a ação na fila se o reenvio falhar de novo", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });
    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    const sender = jest.fn().mockRejectedValue(new Error("ainda sem rede"));
    await queue.drain(sender);

    expect(await queue.list()).toHaveLength(1);
  });

  it("descarta a ação (não mantém pra retry) quando o reenvio bate numa rejeição definitiva do servidor (ex.: item cancelado enquanto offline)", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });
    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    const sender = jest.fn().mockRejectedValue(new ApiClientError("Este item não está atribuído a você.", "NOT_YOUR_ITEM", 403));
    await queue.drain(sender);

    expect(await queue.list()).toHaveLength(0);
  });

  it("mantém a ação na fila quando o reenvio falha com 401 (sessão expirada, não é uma rejeição ligada ao item)", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });
    await queue.enqueue({ queueItemId: "item-1", type: "complete" });

    const sender = jest.fn().mockRejectedValue(new ApiClientError("Sessão expirada.", "SESSION_EXPIRED", 401));
    await queue.drain(sender);

    expect(await queue.list()).toHaveLength(1);
  });

  it("reportar problema carrega a nota junto", async () => {
    const storage = createStorageMock();
    const queue = createPendingActionsQueue({ storage });
    await queue.enqueue({ queueItemId: "item-2", type: "problem", note: "quebrado" });

    const sender = jest.fn().mockResolvedValue(undefined);
    await queue.drain(sender);

    expect(sender).toHaveBeenCalledWith({ queueItemId: "item-2", type: "problem", note: "quebrado" });
  });
});
