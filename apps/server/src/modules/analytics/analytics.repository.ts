import { sql } from "drizzle-orm";
import type { DbInstance } from "@catavento/db";

const MIN_SAMPLE_SIZE = 3;

export type OperatorAnalyticsRowRaw = {
  operatorId: string;
  displayName: string;
  completedCount: number;
  abandonedCount: number;
  problemCount: number;
  inProgressCount: number;
  activeSecondsTotal: number;
  avgDurationSeconds: number | null;
  completionRate: number;
  weightedRelativeSpeedScore: number | null;
};

export type ProductAnalyticsRowRaw = {
  productId: string;
  productName: string;
  completedCount: number;
  avgDurationSeconds: number | null;
  stddevDurationSeconds: number | null;
  distinctOperators: number;
};

export function analyticsRepository(db: DbInstance) {
  return {
    async getWeightedRelativeSpeedScores(from: string, to: string): Promise<Map<string, number>> {
      const result = await db.execute(sql`
        WITH operator_product_stats AS (
          SELECT
            wl.operator_id,
            qi.product_id,
            COUNT(*) AS completed_count,
            AVG(wl.duration_seconds) AS avg_duration_operator
          FROM work_logs wl
          JOIN queue_items qi ON qi.id = wl.queue_item_id
          WHERE wl.outcome = 'completed'
            AND qi.product_id IS NOT NULL
            AND wl.started_at BETWEEN ${from} AND ${to}
          GROUP BY wl.operator_id, qi.product_id
        ),
        team_product_stats AS (
          SELECT
            qi.product_id,
            AVG(wl.duration_seconds) AS avg_duration_team
          FROM work_logs wl
          JOIN queue_items qi ON qi.id = wl.queue_item_id
          WHERE wl.outcome = 'completed'
            AND qi.product_id IS NOT NULL
            AND wl.started_at BETWEEN ${from} AND ${to}
          GROUP BY qi.product_id
        ),
        relative AS (
          SELECT
            ops.operator_id,
            ops.completed_count,
            CASE
              WHEN ops.avg_duration_operator IS NULL OR ops.avg_duration_operator = 0 THEN NULL
              ELSE tps.avg_duration_team / ops.avg_duration_operator
            END AS relative_speed_index
          FROM operator_product_stats ops
          JOIN team_product_stats tps ON tps.product_id = ops.product_id
          WHERE ops.completed_count >= ${MIN_SAMPLE_SIZE}
        )
        SELECT
          operator_id,
          SUM(relative_speed_index * completed_count) / NULLIF(SUM(completed_count), 0) AS weighted_score
        FROM relative
        WHERE relative_speed_index IS NOT NULL
        GROUP BY operator_id
      `);
      const map = new Map<string, number>();
      for (const row of result.rows as Array<Record<string, unknown>>) {
        // O WHERE relative_speed_index IS NOT NULL na CTE já garante que
        // toda linha agrupada aqui tem weighted_score definido.
        map.set(row.operator_id as string, Number(row.weighted_score));
      }
      return map;
    },

    async getByOperator(
      from: string,
      to: string,
      pagination: { page: number; pageSize: number }
    ): Promise<{ items: OperatorAnalyticsRowRaw[]; total: number }> {
      const scores = await this.getWeightedRelativeSpeedScores(from, to);

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT wl.operator_id) AS total
        FROM work_logs wl
        WHERE wl.started_at BETWEEN ${from} AND ${to}
      `);
      const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

      const offset = (pagination.page - 1) * pagination.pageSize;
      const result = await db.execute(sql`
        SELECT
          wl.operator_id,
          u.display_name,
          COUNT(*) FILTER (WHERE wl.outcome = 'completed') AS completed_count,
          COUNT(*) FILTER (WHERE wl.outcome = 'abandoned') AS abandoned_count,
          COUNT(*) FILTER (WHERE wl.outcome = 'problem') AS problem_count,
          COUNT(*) FILTER (WHERE wl.completed_at IS NULL) AS in_progress_count,
          COALESCE(SUM(wl.duration_seconds) FILTER (WHERE wl.outcome = 'completed'), 0) AS active_seconds_total,
          AVG(wl.duration_seconds) FILTER (WHERE wl.outcome = 'completed') AS avg_duration_seconds
        FROM work_logs wl
        JOIN users u ON u.id = wl.operator_id
        WHERE wl.started_at BETWEEN ${from} AND ${to}
        GROUP BY wl.operator_id, u.display_name
        ORDER BY u.display_name ASC
        LIMIT ${pagination.pageSize} OFFSET ${offset}
      `);

      const items = (result.rows as Array<Record<string, unknown>>).map((row) => {
        const completed = Number(row.completed_count);
        const abandoned = Number(row.abandoned_count);
        const problem = Number(row.problem_count);
        const inProgress = Number(row.in_progress_count);
        const totalAssigned = completed + abandoned + problem + inProgress;
        return {
          operatorId: row.operator_id as string,
          displayName: row.display_name as string,
          completedCount: completed,
          abandonedCount: abandoned,
          problemCount: problem,
          inProgressCount: inProgress,
          activeSecondsTotal: Number(row.active_seconds_total),
          avgDurationSeconds: row.avg_duration_seconds === null ? null : Number(row.avg_duration_seconds),
          completionRate: totalAssigned > 0 ? completed / totalAssigned : 0,
          weightedRelativeSpeedScore: scores.get(row.operator_id as string) ?? null,
        };
      });

      return { items, total };
    },

    async getByProduct(
      from: string,
      to: string,
      pagination: { page: number; pageSize: number }
    ): Promise<{ items: ProductAnalyticsRowRaw[]; total: number }> {
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT qi.product_id) AS total
        FROM work_logs wl
        JOIN queue_items qi ON qi.id = wl.queue_item_id
        WHERE wl.outcome = 'completed' AND qi.product_id IS NOT NULL
          AND wl.started_at BETWEEN ${from} AND ${to}
      `);
      const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

      const offset = (pagination.page - 1) * pagination.pageSize;
      const result = await db.execute(sql`
        SELECT
          qi.product_id,
          p.name AS product_name,
          COUNT(*) AS completed_count,
          AVG(wl.duration_seconds) AS avg_duration_seconds,
          STDDEV(wl.duration_seconds) AS stddev_duration_seconds,
          COUNT(DISTINCT wl.operator_id) AS distinct_operators
        FROM work_logs wl
        JOIN queue_items qi ON qi.id = wl.queue_item_id
        JOIN products p ON p.id = qi.product_id
        WHERE wl.outcome = 'completed' AND qi.product_id IS NOT NULL
          AND wl.started_at BETWEEN ${from} AND ${to}
        GROUP BY qi.product_id, p.name
        ORDER BY p.name ASC
        LIMIT ${pagination.pageSize} OFFSET ${offset}
      `);

      const items = (result.rows as Array<Record<string, unknown>>).map((row) => ({
        productId: row.product_id as string,
        productName: row.product_name as string,
        completedCount: Number(row.completed_count),
        avgDurationSeconds: row.avg_duration_seconds === null ? null : Number(row.avg_duration_seconds),
        stddevDurationSeconds: row.stddev_duration_seconds === null ? null : Number(row.stddev_duration_seconds),
        distinctOperators: Number(row.distinct_operators),
      }));

      return { items, total };
    },

    async getThroughput(
      from: string,
      to: string,
      bucket: "hour" | "day"
    ): Promise<Array<{ bucket: string; completedCount: number }>> {
      // `bucket` sempre entra como parâmetro bind (nunca concatenado em SQL),
      // então mesmo sem a validação Zod upstream não haveria risco de
      // injeção — o CASE abaixo evita a necessidade de sql.raw() para o
      // literal de INTERVAL, que não aceita bind direto no Postgres.
      const result = await db.execute(sql`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc(${bucket}, ${from}::timestamptz),
            date_trunc(${bucket}, ${to}::timestamptz),
            CASE WHEN ${bucket} = 'hour' THEN interval '1 hour' ELSE interval '1 day' END
          ) AS bucket
        ),
        completed AS (
          SELECT date_trunc(${bucket}, wl.completed_at) AS bucket, COUNT(*) AS completed_count
          FROM work_logs wl
          WHERE wl.outcome = 'completed' AND wl.completed_at BETWEEN ${from} AND ${to}
          GROUP BY 1
        )
        SELECT b.bucket, COALESCE(c.completed_count, 0) AS completed_count
        FROM buckets b
        LEFT JOIN completed c ON c.bucket = b.bucket
        ORDER BY b.bucket ASC
      `);
      return (result.rows as Array<Record<string, unknown>>).map((row) => ({
        bucket: new Date(row.bucket as string | Date).toISOString(),
        completedCount: Number(row.completed_count),
      }));
    },

    async getGapStats(operatorId: string, from: string, to: string): Promise<{ avgGapSeconds: number | null }> {
      const result = await db.execute(sql`
        WITH ordered AS (
          SELECT
            started_at,
            LAG(completed_at) OVER (PARTITION BY operator_id ORDER BY started_at) AS prev_completed_at
          FROM work_logs
          WHERE operator_id = ${operatorId} AND outcome = 'completed'
            AND started_at BETWEEN ${from} AND ${to}
        )
        SELECT AVG(EXTRACT(EPOCH FROM (started_at - prev_completed_at))) AS avg_gap_seconds
        FROM ordered
        WHERE prev_completed_at IS NOT NULL
      `);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      const value = row?.avg_gap_seconds;
      return { avgGapSeconds: value === null || value === undefined ? null : Number(value) };
    },

    async getDurationCoefficientOfVariation(operatorId: string, from: string, to: string): Promise<number | null> {
      const result = await db.execute(sql`
        SELECT
          AVG(duration_seconds) AS avg_duration,
          STDDEV(duration_seconds) AS stddev_duration
        FROM work_logs
        WHERE operator_id = ${operatorId} AND outcome = 'completed'
          AND started_at BETWEEN ${from} AND ${to}
      `);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      const avg = row?.avg_duration === null || row?.avg_duration === undefined ? null : Number(row.avg_duration);
      const stddev =
        row?.stddev_duration === null || row?.stddev_duration === undefined ? null : Number(row.stddev_duration);
      if (avg === null || stddev === null || avg === 0) return null;
      return stddev / avg;
    },

    async getByProductForOperator(
      operatorId: string,
      from: string,
      to: string
    ): Promise<Array<{ productId: string; productName: string; completedCount: number; avgDurationSeconds: number | null; teamAvgDurationSeconds: number | null }>> {
      const result = await db.execute(sql`
        WITH operator_stats AS (
          SELECT qi.product_id, p.name AS product_name, COUNT(*) AS completed_count, AVG(wl.duration_seconds) AS avg_duration
          FROM work_logs wl
          JOIN queue_items qi ON qi.id = wl.queue_item_id
          JOIN products p ON p.id = qi.product_id
          WHERE wl.operator_id = ${operatorId} AND wl.outcome = 'completed'
            AND wl.started_at BETWEEN ${from} AND ${to}
          GROUP BY qi.product_id, p.name
        ),
        team_stats AS (
          SELECT qi.product_id, AVG(wl.duration_seconds) AS avg_duration_team
          FROM work_logs wl
          JOIN queue_items qi ON qi.id = wl.queue_item_id
          WHERE wl.outcome = 'completed' AND wl.started_at BETWEEN ${from} AND ${to}
          GROUP BY qi.product_id
        )
        SELECT os.product_id, os.product_name, os.completed_count, os.avg_duration, ts.avg_duration_team
        FROM operator_stats os
        JOIN team_stats ts ON ts.product_id = os.product_id
        ORDER BY os.product_name ASC
      `);
      // avg_duration/avg_duration_team nunca são NULL aqui: cada linha vem de
      // um GROUP BY sobre work_logs já filtrados por outcome='completed', e
      // duration_seconds é sempre preenchido nesse caso (completeItem sempre
      // o define). Sem `?? null` desnecessário para um caso que não ocorre.
      return (result.rows as Array<Record<string, unknown>>).map((row) => ({
        productId: row.product_id as string,
        productName: row.product_name as string,
        completedCount: Number(row.completed_count),
        avgDurationSeconds: Number(row.avg_duration),
        teamAvgDurationSeconds: Number(row.avg_duration_team),
      }));
    },

    async getOperatorOverviewCounts(
      operatorId: string,
      from: string,
      to: string
    ): Promise<{ completedCount: number; abandonedCount: number; problemCount: number; inProgressCount: number; avgDurationSeconds: number | null }> {
      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE outcome = 'completed') AS completed_count,
          COUNT(*) FILTER (WHERE outcome = 'abandoned') AS abandoned_count,
          COUNT(*) FILTER (WHERE outcome = 'problem') AS problem_count,
          COUNT(*) FILTER (WHERE completed_at IS NULL) AS in_progress_count,
          AVG(duration_seconds) FILTER (WHERE outcome = 'completed') AS avg_duration_seconds
        FROM work_logs
        WHERE operator_id = ${operatorId} AND started_at BETWEEN ${from} AND ${to}
      `);
      const row = result.rows[0] as Record<string, unknown>;
      return {
        completedCount: Number(row.completed_count),
        abandonedCount: Number(row.abandoned_count),
        problemCount: Number(row.problem_count),
        inProgressCount: Number(row.in_progress_count),
        avgDurationSeconds: row.avg_duration_seconds === null ? null : Number(row.avg_duration_seconds),
      };
    },

    async getDailyTimeSeries(
      operatorId: string,
      from: string,
      to: string
    ): Promise<Array<{ date: string; completedCount: number; avgDurationSeconds: number | null }>> {
      const result = await db.execute(sql`
        SELECT
          date_trunc('day', completed_at) AS day,
          COUNT(*) AS completed_count,
          AVG(duration_seconds) AS avg_duration_seconds
        FROM work_logs
        WHERE operator_id = ${operatorId} AND outcome = 'completed'
          AND completed_at BETWEEN ${from} AND ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      // Cada linha já vem de um GROUP BY sobre work_logs com
      // outcome='completed' — avg_duration_seconds nunca é NULL aqui.
      return (result.rows as Array<Record<string, unknown>>).map((row) => ({
        date: new Date(row.day as string | Date).toISOString().slice(0, 10),
        completedCount: Number(row.completed_count),
        avgDurationSeconds: Number(row.avg_duration_seconds),
      }));
    },
  };
}

export type AnalyticsRepository = ReturnType<typeof analyticsRepository>;
export { MIN_SAMPLE_SIZE };
