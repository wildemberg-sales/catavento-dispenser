import type { OperatorReport } from "@catavento/contracts/analytics";
import type { AnalyticsRepository } from "./analytics.repository.js";
import type { UsersRepository } from "../users/users.repository.js";
import { OperatorNotFoundError, RangeTooLargeError } from "../../lib/errors.js";

const MAX_RANGE_DAYS_DEFAULT = 90;

function assertRange(from: string, to: string, maxRangeDays: number) {
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > maxRangeDays) {
    throw new RangeTooLargeError(maxRangeDays);
  }
}

export function analyticsService(deps: {
  repo: AnalyticsRepository;
  usersRepo: UsersRepository;
  maxRangeDays?: number;
}) {
  const { repo, usersRepo } = deps;
  const maxRangeDays = deps.maxRangeDays ?? MAX_RANGE_DAYS_DEFAULT;

  return {
    async getByOperator(from: string, to: string, pagination: { page: number; pageSize: number }) {
      assertRange(from, to, maxRangeDays);
      const { items, total } = await repo.getByOperator(from, to, pagination);
      return { items, total, page: pagination.page, pageSize: pagination.pageSize };
    },

    async getByProduct(from: string, to: string, pagination: { page: number; pageSize: number }) {
      assertRange(from, to, maxRangeDays);
      const { items, total } = await repo.getByProduct(from, to, pagination);
      return { items, total, page: pagination.page, pageSize: pagination.pageSize };
    },

    async getThroughput(from: string, to: string, bucket: "hour" | "day") {
      assertRange(from, to, maxRangeDays);
      return repo.getThroughput(from, to, bucket);
    },

    async getOperatorReport(operatorId: string, from: string, to: string): Promise<OperatorReport> {
      assertRange(from, to, maxRangeDays);
      const user = await usersRepo.findById(operatorId);
      if (!user) throw new OperatorNotFoundError();

      const [overviewCounts, gapStats, cv, byProduct, timeSeries, scores] = await Promise.all([
        repo.getOperatorOverviewCounts(operatorId, from, to),
        repo.getGapStats(operatorId, from, to),
        repo.getDurationCoefficientOfVariation(operatorId, from, to),
        repo.getByProductForOperator(operatorId, from, to),
        repo.getDailyTimeSeries(operatorId, from, to),
        repo.getWeightedRelativeSpeedScores(from, to),
      ]);

      const totalAssigned =
        overviewCounts.completedCount + overviewCounts.abandonedCount + overviewCounts.problemCount + overviewCounts.inProgressCount;
      const completionRate = totalAssigned > 0 ? overviewCounts.completedCount / totalAssigned : 0;
      const problemRate = totalAssigned > 0 ? overviewCounts.problemCount / totalAssigned : 0;
      const abandonmentRate = totalAssigned > 0 ? overviewCounts.abandonedCount / totalAssigned : 0;

      const activeHours = overviewCounts.avgDurationSeconds
        ? (overviewCounts.avgDurationSeconds * overviewCounts.completedCount) / 3600
        : 0;
      const itemsPerHour = activeHours > 0 ? overviewCounts.completedCount / activeHours : 0;

      // Índice de pontualidade normalizado contra a equipe (Seção 6.6.1) —
      // pesos 50/50 são um ponto de partida, ajustável depois de ver dados
      // reais (constante nomeada, não mágica).
      const GAP_WEIGHT = 0.5;
      const CV_WEIGHT = 0.5;
      const punctualityIndex =
        gapStats.avgGapSeconds !== null && cv !== null
          ? Math.max(0, 1 - (Math.min(gapStats.avgGapSeconds / 3600, 1) * GAP_WEIGHT + Math.min(cv, 1) * CV_WEIGHT))
          : null;

      const sortedScores = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
      const positionIndex = sortedScores.findIndex(([id]) => id === operatorId);

      return {
        operator: { id: user.id, username: user.username, displayName: user.displayName },
        period: { from, to },
        overview: {
          productivity: {
            itemsPerHour,
            avgDurationSeconds: overviewCounts.avgDurationSeconds,
            completedCount: overviewCounts.completedCount,
          },
          quality: {
            completionRate,
            problemRate,
            abandonmentRate,
            qualityIndex: completionRate - problemRate - abandonmentRate,
          },
          punctuality: {
            avgGapSeconds: gapStats.avgGapSeconds,
            durationCoefficientOfVariation: cv,
            punctualityIndex,
          },
        },
        byProduct: byProduct.map((p) => ({
          ...p,
          // avgDurationSeconds/teamAvgDurationSeconds só são nulos se a
          // consulta não retornar linha nenhuma para o produto (o que não
          // ocorre aqui, já vêm de um GROUP BY com pelo menos 1 item
          // concluído) — a checagem `> 0` protege apenas contra o caso
          // extremo de duração zero (início e fim no mesmo instante).
          relativeSpeedIndex: p.avgDurationSeconds! > 0 ? p.teamAvgDurationSeconds! / p.avgDurationSeconds! : null,
        })),
        ranking: {
          weightedRelativeSpeedScore: scores.get(operatorId) ?? null,
          positionAmongOperators: positionIndex >= 0 ? positionIndex + 1 : null,
          totalOperatorsRanked: sortedScores.length,
        },
        timeSeries: timeSeries.map((t) => ({
          date: t.date,
          completedCount: t.completedCount,
          avgDurationSeconds: t.avgDurationSeconds,
          itemsPerHour: t.avgDurationSeconds ? 3600 / t.avgDurationSeconds : 0,
        })),
      };
    },
  };
}

export type AnalyticsService = ReturnType<typeof analyticsService>;
