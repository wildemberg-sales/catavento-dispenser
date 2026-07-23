import React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "../../theme/colors";
import { formatDateTime } from "../../utils/formatDateTime";
import { DateTimeAxisTick } from "./DateTimeAxisTick";

function dateTimeLabelFormatter(value: React.ReactNode): React.ReactNode {
  if (typeof value !== "string" && typeof value !== "number") return value;
  const { date, time } = formatDateTime(value);
  return `${date} ${time}`;
}

export function TrendChart({
  data,
  xKey,
  yKey,
  variant = "bar",
  height = 240,
  dateTimeAxis = false,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  variant?: "bar" | "line";
  height?: number;
  dateTimeAxis?: boolean;
}) {
  const xAxisProps = dateTimeAxis
    ? { dataKey: xKey, stroke: colors.textMuted, height: 44, tick: <DateTimeAxisTick /> }
    : { dataKey: xKey, stroke: colors.textMuted, fontSize: 12 };
  const tooltipProps = dateTimeAxis ? { labelFormatter: dateTimeLabelFormatter } : {};

  // width="100%" — o container (Card da tela) já cuida da largura disponível;
  // sem isso o gráfico tinha largura fixa em pixels e ou sobrava espaço vazio
  // em telas largas, ou vazava/cortava em telas estreitas.
  if (variant === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis {...xAxisProps} />
          <YAxis stroke={colors.textMuted} fontSize={12} allowDecimals={false} />
          <Tooltip {...tooltipProps} />
          <Line type="monotone" dataKey={yKey} stroke={colors.primary} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
        <XAxis {...xAxisProps} />
        <YAxis stroke={colors.textMuted} fontSize={12} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey={yKey} fill={colors.primary} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
