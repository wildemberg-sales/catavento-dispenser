import React from "react";
import type { ThroughputPoint } from "@catavento/contracts/analytics";
import { Card } from "../../components/Card";
import { TrendChart } from "../../components/charts/TrendChart";

type ThroughputTabProps = {
  points: ThroughputPoint[] | null;
  bucket: "hour" | "day";
  onBucketChange: (bucket: "hour" | "day") => void;
};

export function ThroughputTab({ points, bucket, onBucketChange }: ThroughputTabProps) {
  return (
    <Card style={styles.throughputCard}>
      <div style={styles.bucketRow}>
        <button
          data-testid="bucket-day"
          className={`btn btn-sm ${bucket === "day" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onBucketChange("day")}
        >
          Por dia
        </button>
        <button
          data-testid="bucket-hour"
          className={`btn btn-sm ${bucket === "hour" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onBucketChange("hour")}
        >
          Por hora
        </button>
      </div>
      <TrendChart data={points ?? []} xKey="bucket" yKey="completedCount" variant="bar" dateTimeAxis />
    </Card>
  );
}

const styles: Record<string, React.CSSProperties> = {
  throughputCard: { padding: 20, display: "flex", flexDirection: "column", gap: 14 },
  bucketRow: { display: "flex", gap: 8 },
};
