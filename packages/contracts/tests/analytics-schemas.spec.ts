import { describe, expect, it } from "vitest";
import {
  analyticsPeriodQuerySchema,
  exportQuerySchema,
  operatorAnalyticsRowSchema,
  operatorReportSchema,
  productAnalyticsRowSchema,
  throughputBucketSchema,
} from "../src/analytics/schemas.js";

describe("analytics schemas", () => {
  it("analyticsPeriodQuerySchema rejeita 'to' anterior ou igual a 'from'", () => {
    const from = new Date("2026-01-10T00:00:00.000Z").toISOString();
    const to = new Date("2026-01-01T00:00:00.000Z").toISOString();
    expect(analyticsPeriodQuerySchema.safeParse({ from, to }).success).toBe(false);
  });

  it("analyticsPeriodQuerySchema aceita 'to' posterior a 'from'", () => {
    const from = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const to = new Date("2026-01-10T00:00:00.000Z").toISOString();
    expect(analyticsPeriodQuerySchema.safeParse({ from, to }).success).toBe(true);
  });

  it("throughputBucketSchema só aceita hour ou day", () => {
    expect(throughputBucketSchema.safeParse("hour").success).toBe(true);
    expect(throughputBucketSchema.safeParse("day").success).toBe(true);
    expect(throughputBucketSchema.safeParse("month").success).toBe(false);
  });

  it("operatorAnalyticsRowSchema valida a forma completa de uma linha", () => {
    const row = {
      operatorId: "3f5a1e2a-0000-4000-8000-000000000000",
      displayName: "Operador 1",
      completedCount: 10,
      abandonedCount: 1,
      problemCount: 0,
      inProgressCount: 0,
      activeSecondsTotal: 3600,
      avgDurationSeconds: 360,
      completionRate: 0.9,
      weightedRelativeSpeedScore: 1.05,
    };
    expect(operatorAnalyticsRowSchema.safeParse(row).success).toBe(true);
  });

  it("productAnalyticsRowSchema valida a forma completa de uma linha", () => {
    const row = {
      productId: "3f5a1e2a-0000-4000-8000-000000000001",
      productName: "Produto X",
      completedCount: 5,
      avgDurationSeconds: 120,
      stddevDurationSeconds: 10,
      distinctOperators: 2,
    };
    expect(productAnalyticsRowSchema.safeParse(row).success).toBe(true);
  });

  it("exportQuerySchema só aceita format csv|xlsx e report enumerado", () => {
    const base = { from: new Date("2026-01-01").toISOString(), to: new Date("2026-01-10").toISOString() };
    expect(exportQuerySchema.safeParse({ ...base, format: "csv", report: "by-operator" }).success).toBe(true);
    expect(exportQuerySchema.safeParse({ ...base, format: "pdf", report: "by-operator" }).success).toBe(false);
    expect(exportQuerySchema.safeParse({ ...base, format: "csv", report: "nao-existe" }).success).toBe(false);
  });

  it("operatorReportSchema valida a forma completa do relatório individual", () => {
    const report = {
      operator: { id: "3f5a1e2a-0000-4000-8000-000000000000", username: "op1", displayName: "Operador 1" },
      period: { from: new Date("2026-01-01").toISOString(), to: new Date("2026-01-10").toISOString() },
      overview: {
        productivity: { itemsPerHour: 5, avgDurationSeconds: 720, completedCount: 10 },
        quality: { completionRate: 0.9, problemRate: 0.05, abandonmentRate: 0.05, qualityIndex: 0.8 },
        punctuality: { avgGapSeconds: 30, durationCoefficientOfVariation: 0.1, punctualityIndex: 0.9 },
      },
      byProduct: [
        {
          productId: "3f5a1e2a-0000-4000-8000-000000000001",
          productName: "Produto X",
          completedCount: 5,
          avgDurationSeconds: 100,
          teamAvgDurationSeconds: 105,
          relativeSpeedIndex: 1.05,
        },
      ],
      ranking: { weightedRelativeSpeedScore: 1.05, positionAmongOperators: 1, totalOperatorsRanked: 3 },
      timeSeries: [{ date: "2026-01-01", completedCount: 2, avgDurationSeconds: 100, itemsPerHour: 4 }],
    };
    expect(operatorReportSchema.safeParse(report).success).toBe(true);
  });
});
