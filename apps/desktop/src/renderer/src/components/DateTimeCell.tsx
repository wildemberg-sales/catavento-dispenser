import React from "react";
import { formatDateTime } from "../utils/formatDateTime";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export function DateTimeCell({ value }: { value: string | number | Date }) {
  const { date, time } = formatDateTime(value);
  return (
    <div style={styles.container}>
      <span style={styles.date}>{date}</span>
      <span style={styles.time}>{time}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", lineHeight: 1.3 },
  date: { ...typography.body },
  time: { ...typography.small, color: colors.textMuted },
};
