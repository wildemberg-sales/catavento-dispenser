import React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "../../theme/colors";

export function TrendChart({
  data,
  xKey,
  yKey,
  variant = "bar",
  width = 560,
  height = 240,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  variant?: "bar" | "line";
  width?: number;
  height?: number;
}) {
  if (variant === "line") {
    return (
      <LineChart width={width} height={height} data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
        <XAxis dataKey={xKey} stroke={colors.textMuted} fontSize={12} />
        <YAxis stroke={colors.textMuted} fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey={yKey} stroke={colors.primary} strokeWidth={2} dot={false} />
      </LineChart>
    );
  }

  return (
    <BarChart width={width} height={height} data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
      <XAxis dataKey={xKey} stroke={colors.textMuted} fontSize={12} />
      <YAxis stroke={colors.textMuted} fontSize={12} allowDecimals={false} />
      <Tooltip />
      <Bar dataKey={yKey} fill={colors.primary} radius={[6, 6, 0, 0]} />
    </BarChart>
  );
}
