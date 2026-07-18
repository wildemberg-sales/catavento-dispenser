import type { QueueApi } from "../api/queue.api";
import type { PendingAction } from "./pendingActionsQueue";

export function createPendingActionSender(queueApi: QueueApi) {
  return (action: PendingAction): Promise<void> =>
    action.type === "complete"
      ? queueApi.complete(action.queueItemId)
      : queueApi.problem(action.queueItemId, action.note ?? "");
}
