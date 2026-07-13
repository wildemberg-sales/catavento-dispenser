import { describe, expect, it, vi } from "vitest";
import { analyticsService } from "../../src/modules/analytics/analytics.service.js";
import { RangeTooLargeError } from "../../src/lib/errors.js";

describe("analyticsService — maxRangeDays default", () => {
  it("usa 90 dias como default quando maxRangeDays não é informado", async () => {
    const repo = { getByOperator: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    const service = analyticsService({ repo: repo as never, usersRepo: {} as never });

    const from = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const withinDefault = new Date("2026-03-01T00:00:00.000Z").toISOString(); // ~59 dias
    await expect(service.getByOperator(from, withinDefault, { page: 1, pageSize: 20 })).resolves.toBeDefined();

    const beyondDefault = new Date("2026-06-01T00:00:00.000Z").toISOString(); // ~150 dias
    await expect(service.getByOperator(from, beyondDefault, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(
      RangeTooLargeError
    );
  });
});
