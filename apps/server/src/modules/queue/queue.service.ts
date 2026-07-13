import type { NextItemResponse, QueueItemStatus } from "@catavento/contracts/queue";
import type { QueueRepository } from "./queue.repository.js";
import { toQueueItemDto } from "./queue.mapper.js";
import { calculateDurationSeconds } from "../../lib/time.js";
import {
  AlreadyCompletedError,
  CannotCancelCompletedError,
  InvalidRequeueStateError,
  NotYourItemError,
  QueueItemNotFoundError,
} from "../../lib/errors.js";

async function assertOwnedActiveItem(repo: QueueRepository, queueItemId: string, operatorId: string) {
  const item = await repo.findById(queueItemId);
  if (!item) {
    throw new QueueItemNotFoundError();
  }
  if (item.status === "completed") {
    throw new AlreadyCompletedError();
  }

  const workLog = await repo.findActiveWorkLog(queueItemId);
  if (!workLog || workLog.operatorId !== operatorId) {
    throw new NotYourItemError();
  }

  return { item, workLog };
}

export function queueService(deps: { repo: QueueRepository }) {
  const { repo } = deps;

  return {
    async dequeueNext(operatorId: string): Promise<NextItemResponse> {
      const result = await repo.dequeueNext(operatorId);
      if (!result) {
        return { available: false };
      }
      const linkedProduct = await repo.findLinkedProduct(result.item.productId);
      return { available: true, item: toQueueItemDto(result.item, linkedProduct) };
    },

    async getCurrentForOperator(operatorId: string): Promise<NextItemResponse> {
      const item = await repo.findCurrentForOperator(operatorId);
      if (!item) {
        return { available: false };
      }
      const linkedProduct = await repo.findLinkedProduct(item.productId);
      return { available: true, item: toQueueItemDto(item, linkedProduct) };
    },

    async completeItem(operatorId: string, queueItemId: string): Promise<void> {
      const { workLog } = await assertOwnedActiveItem(repo, queueItemId, operatorId);
      const completedAt = new Date();
      const durationSeconds = calculateDurationSeconds(workLog.startedAt, completedAt);
      await repo.finishWorkLog({
        workLogId: workLog.id,
        queueItemId,
        completedAt,
        durationSeconds,
        outcome: "completed",
        finalStatus: "completed",
      });
    },

    async reportProblem(operatorId: string, queueItemId: string, note: string): Promise<void> {
      const { workLog } = await assertOwnedActiveItem(repo, queueItemId, operatorId);
      const completedAt = new Date();
      const durationSeconds = calculateDurationSeconds(workLog.startedAt, completedAt);
      await repo.finishWorkLog({
        workLogId: workLog.id,
        queueItemId,
        completedAt,
        durationSeconds,
        outcome: "problem",
        problemNote: note,
        finalStatus: "problem",
      });
    },

    async abandonStale(timeoutMinutes: number): Promise<number> {
      return repo.abandonStale(timeoutMinutes);
    },

    async listForAdmin(
      filters: { status?: QueueItemStatus | undefined; batchId?: string | undefined },
      pagination: { page: number; pageSize: number }
    ) {
      const { items, total } = await repo.adminListItems(filters, pagination);
      return {
        items: items.map((row) => toQueueItemDto({ ...row, payload: row.payload as Record<string, unknown> })),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    },

    async requeueItem(queueItemId: string): Promise<void> {
      const item = await repo.findById(queueItemId);
      if (!item) throw new QueueItemNotFoundError();
      if (item.status !== "cancelled" && item.status !== "problem") {
        throw new InvalidRequeueStateError();
      }
      await repo.adminRequeue(queueItemId);
    },

    async cancelItem(queueItemId: string): Promise<void> {
      const item = await repo.findById(queueItemId);
      if (!item) throw new QueueItemNotFoundError();
      if (item.status === "completed") throw new CannotCancelCompletedError();
      await repo.adminCancel(queueItemId);
    },
  };
}

export type QueueService = ReturnType<typeof queueService>;
