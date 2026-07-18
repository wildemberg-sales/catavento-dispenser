const STORAGE_KEY = "catavento.pendingActions";

export type PendingAction = {
  queueItemId: string;
  type: "complete" | "problem";
  note?: string;
};

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createPendingActionsQueue(deps: { storage: StorageLike }) {
  const { storage } = deps;

  async function readAll(): Promise<PendingAction[]> {
    const raw = await storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAction[]) : [];
  }

  async function writeAll(actions: PendingAction[]): Promise<void> {
    await storage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }

  return {
    async enqueue(action: PendingAction): Promise<void> {
      const actions = await readAll();
      const alreadyQueued = actions.some((a) => a.queueItemId === action.queueItemId && a.type === action.type);
      if (alreadyQueued) return;
      await writeAll([...actions, action]);
    },

    async list(): Promise<PendingAction[]> {
      return readAll();
    },

    async drain(sender: (action: PendingAction) => Promise<void>): Promise<void> {
      const actions = await readAll();
      const remaining: PendingAction[] = [];
      for (const action of actions) {
        try {
          await sender(action);
        } catch {
          remaining.push(action);
        }
      }
      await writeAll(remaining);
    },
  };
}

export type PendingActionsQueue = ReturnType<typeof createPendingActionsQueue>;
