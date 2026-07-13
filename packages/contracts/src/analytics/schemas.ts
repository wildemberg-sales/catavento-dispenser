import { z } from "zod";

export const analyticsPeriodQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((v) => new Date(v.to) > new Date(v.from), {
    message: "'to' deve ser posterior a 'from'.",
  });
export type AnalyticsPeriodQuery = z.infer<typeof analyticsPeriodQuerySchema>;

export const throughputBucketSchema = z.enum(["hour", "day"]);
export type ThroughputBucket = z.infer<typeof throughputBucketSchema>;

export const operatorAnalyticsRowSchema = z.object({
  operatorId: z.string().uuid(),
  displayName: z.string(),
  completedCount: z.number().int(),
  abandonedCount: z.number().int(),
  problemCount: z.number().int(),
  inProgressCount: z.number().int(),
  activeSecondsTotal: z.number().int(),
  avgDurationSeconds: z.number().nullable(),
  completionRate: z.number(),
  weightedRelativeSpeedScore: z.number().nullable(),
});
export type OperatorAnalyticsRow = z.infer<typeof operatorAnalyticsRowSchema>;

export const productAnalyticsRowSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  completedCount: z.number().int(),
  avgDurationSeconds: z.number().nullable(),
  stddevDurationSeconds: z.number().nullable(),
  distinctOperators: z.number().int(),
});
export type ProductAnalyticsRow = z.infer<typeof productAnalyticsRowSchema>;

export const throughputPointSchema = z.object({
  bucket: z.string(),
  completedCount: z.number().int(),
});
export type ThroughputPoint = z.infer<typeof throughputPointSchema>;

export const throughputQuerySchema = z
  .object({
    bucket: throughputBucketSchema,
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((v) => new Date(v.to) > new Date(v.from), { message: "'to' deve ser posterior a 'from'." });
export type ThroughputQuery = z.infer<typeof throughputQuerySchema>;

export const operatorReportSchema = z.object({
  operator: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
  }),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  overview: z.object({
    productivity: z.object({
      itemsPerHour: z.number(),
      avgDurationSeconds: z.number().nullable(),
      completedCount: z.number().int(),
    }),
    quality: z.object({
      completionRate: z.number(),
      problemRate: z.number(),
      abandonmentRate: z.number(),
      qualityIndex: z.number(),
    }),
    punctuality: z.object({
      avgGapSeconds: z.number().nullable(),
      durationCoefficientOfVariation: z.number().nullable(),
      punctualityIndex: z.number().nullable(),
    }),
  }),
  byProduct: z.array(
    z.object({
      productId: z.string().uuid(),
      productName: z.string(),
      completedCount: z.number().int(),
      avgDurationSeconds: z.number().nullable(),
      teamAvgDurationSeconds: z.number().nullable(),
      relativeSpeedIndex: z.number().nullable(),
    })
  ),
  ranking: z.object({
    weightedRelativeSpeedScore: z.number().nullable(),
    positionAmongOperators: z.number().int().nullable(),
    totalOperatorsRanked: z.number().int(),
  }),
  timeSeries: z.array(
    z.object({
      date: z.string(),
      completedCount: z.number().int(),
      avgDurationSeconds: z.number().nullable(),
      itemsPerHour: z.number(),
    })
  ),
});
export type OperatorReport = z.infer<typeof operatorReportSchema>;

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  report: z.enum(["by-operator", "by-product", "throughput", "operator-report"]),
  from: z.string().datetime(),
  to: z.string().datetime(),
  operatorId: z.string().uuid().optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
