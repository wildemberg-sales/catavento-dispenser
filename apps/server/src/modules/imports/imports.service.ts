import type { ColumnMapping, ImportPreviewResponse } from "@catavento/contracts/imports";
import { AlreadyConfirmedError, ImportBatchNotFoundError } from "../../lib/errors.js";
import type { ImportsRepository } from "./imports.repository.js";
import type { PriorityRulesRepository } from "../queue/priority-rules.repository.js";
import type { QueueRepository } from "../queue/queue.repository.js";
import type { MonitorBus } from "../../lib/monitor-bus.js";
import { parseFile } from "./file-parser.js";
import { suggestColumnMapping } from "./column-mapper.js";
import { validateRow } from "./row-validator.js";
import { resolvePriority } from "../queue/priority-rules.js";
import { toImportBatchDto, toImportBatchRowDto } from "./imports.mapper.js";

const PREVIEW_SAMPLE_SIZE = 20;

export function importsService(deps: {
  repo: ImportsRepository;
  priorityRulesRepo: PriorityRulesRepository;
  queueRepo: QueueRepository;
  bus: MonitorBus;
}) {
  const { repo, priorityRulesRepo, queueRepo, bus } = deps;

  return {
    async createPreview(buffer: Buffer, filename: string, importedBy: string): Promise<ImportPreviewResponse> {
      const parsed = await parseFile(buffer, filename);
      const suggestedMapping = suggestColumnMapping(parsed.headers);

      const seenRefs = new Set<string>();
      const validated = parsed.rows.map((row, index) =>
        validateRow(row, index + 1, suggestedMapping, seenRefs)
      );

      const validRows = validated.filter((r) => r.isValid).length;
      const rejectedRows = validated.length - validRows;

      const batch = await repo.insertBatch({
        filename,
        sourceType: parsed.sourceType,
        importedBy,
        columnMapping: suggestedMapping,
        totalItems: parsed.rows.length,
        validItems: validRows,
        rejectedItems: rejectedRows,
        status: "processing",
      });

      await repo.insertRows(batch.id, parsed.rows, validated);

      return {
        batchId: batch.id,
        filename,
        sourceType: parsed.sourceType,
        suggestedMapping,
        availableColumns: parsed.headers,
        totalRows: parsed.rows.length,
        validRows,
        rejectedRows,
        sampleRows: validated.slice(0, PREVIEW_SAMPLE_SIZE).map(toImportBatchRowDto),
      };
    },

    async confirmImport(batchId: string, columnMapping: ColumnMapping) {
      const batch = await repo.findBatchById(batchId);
      if (!batch) throw new ImportBatchNotFoundError();
      if (batch.status === "ready") throw new AlreadyConfirmedError();

      const rawRows = await repo.findRowsRawOrdered(batchId);
      const rulesMap = await priorityRulesRepo.findAsMap();

      const seenRefs = new Set<string>();
      let validCount = 0;
      const toInsert: Array<{ externalRef: string; source: string; priority: number; payload: Record<string, unknown> }> = [];

      for (const raw of rawRows) {
        const revalidated = validateRow(
          raw.rawData as Record<string, string>,
          raw.rowNumber,
          columnMapping,
          seenRefs
        );
        await repo.updateRowValidation(raw.id, revalidated);

        if (revalidated.isValid && revalidated.externalRef && revalidated.source) {
          validCount++;
          toInsert.push({
            externalRef: revalidated.externalRef,
            source: revalidated.source,
            priority: resolvePriority(revalidated.source, revalidated.priorityOverride, rulesMap),
            payload: revalidated.payload,
          });
        }
      }

      await repo.insertQueueItemsForValidRows(batchId, toInsert);

      if (toInsert.length > 0) {
        const queueSize = await queueRepo.countPending();
        bus.publish({ type: "queue_size_changed", payload: { queueSize } });
      }

      const rejectedCount = rawRows.length - validCount;
      const status = validCount > 0 ? "ready" : "failed";

      await repo.updateBatchAfterConfirm(batchId, {
        status,
        columnMapping,
        totalItems: rawRows.length,
        validItems: validCount,
        rejectedItems: rejectedCount,
      });

      const updated = await repo.findBatchById(batchId);
      return toImportBatchDto(updated!);
    },

    async listBatches(pagination: { page: number; pageSize: number }) {
      const { items, total } = await repo.listBatches(pagination);
      return { items: items.map(toImportBatchDto), total, page: pagination.page, pageSize: pagination.pageSize };
    },

    async getBatch(batchId: string) {
      const batch = await repo.findBatchById(batchId);
      if (!batch) throw new ImportBatchNotFoundError();
      return toImportBatchDto(batch);
    },

    async listRows(
      batchId: string,
      filters: { status?: "valid" | "invalid" | undefined },
      pagination: { page: number; pageSize: number }
    ) {
      const batch = await repo.findBatchById(batchId);
      if (!batch) throw new ImportBatchNotFoundError();
      const { items, total } = await repo.findRows(batchId, filters, pagination);
      return {
        items: items.map((row) =>
          toImportBatchRowDto({
            rowNumber: row.rowNumber,
            externalRef: row.externalRef,
            source: row.source,
            payload: row.payload as Record<string, unknown> | null,
            isValid: row.isValid,
            rejectionReason: row.rejectionReason,
          })
        ),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    },

    async linkBatch(batchId: string) {
      const batch = await repo.findBatchById(batchId);
      if (!batch) throw new ImportBatchNotFoundError();
      return repo.linkBatchBySku(batchId);
    },

    async getUnlinked(batchId: string, pagination: { page: number; pageSize: number }) {
      const batch = await repo.findBatchById(batchId);
      if (!batch) throw new ImportBatchNotFoundError();

      const { items, total } = await repo.findUnlinkedWithSuggestions(batchId, pagination);
      const withSuggestions = await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          externalRef: item.externalRef,
          source: item.source,
          payload: item.payload,
          batchId,
          createdAt: item.createdAt.toISOString(),
          suggestions: await repo.findSuggestionsForItem(item.externalRef, item.payload),
        }))
      );
      return { items: withSuggestions, total, page: pagination.page, pageSize: pagination.pageSize };
    },
  };
}

export type ImportsService = ReturnType<typeof importsService>;
