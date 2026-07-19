import type { QueueService } from "../queue/queue.service.js";
import type { QueueRepository } from "../queue/queue.repository.js";
import type { MonitorBus } from "../../lib/monitor-bus.js";

// Decorator que publica eventos de monitor em torno do queueService já
// existente, sem que este precise conhecer o monitor (zero import cruzado,
// service continua puro/testável isoladamente).
export function withMonitorEvents(service: QueueService, bus: MonitorBus, repo: QueueRepository): QueueService {
  return {
    ...service,

    async dequeueNext(operatorId) {
      const result = await service.dequeueNext(operatorId);
      if (result.available) {
        const queueSize = await repo.countPending();
        bus.publish({
          type: "item_assigned",
          payload: { queueItemId: result.item.id, operatorId, queueSize },
        });
      }
      return result;
    },

    async completeItem(operatorId, queueItemId) {
      await service.completeItem(operatorId, queueItemId);
      bus.publish({
        type: "item_completed",
        payload: { queueItemId, operatorId, outcome: "completed" },
      });
    },

    async reportProblem(operatorId, queueItemId, note) {
      await service.reportProblem(operatorId, queueItemId, note);
      bus.publish({
        type: "item_completed",
        payload: { queueItemId, operatorId, outcome: "problem" },
      });
    },

    async requeueItem(queueItemId) {
      await service.requeueItem(queueItemId);
      const queueSize = await repo.countPending();
      bus.publish({ type: "queue_size_changed", payload: { queueSize } });
    },

    async cancelItem(queueItemId) {
      await service.cancelItem(queueItemId);
      const queueSize = await repo.countPending();
      bus.publish({ type: "queue_size_changed", payload: { queueSize } });
    },
  };
}
