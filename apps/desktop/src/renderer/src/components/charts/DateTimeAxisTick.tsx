import React from "react";
import { colors } from "../../theme/colors";
import { formatDateTime } from "../../utils/formatDateTime";

export function DateTimeAxisTick(props: { x?: number; y?: number; payload?: { value: string | number | Date } }) {
  const { x = 0, y = 0, payload } = props;
  if (!payload) return null;
  const { date, time } = formatDateTime(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill={colors.textMuted}>
        {date}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fill={colors.textMuted}>
        {time}
      </text>
    </g>
  );
}
