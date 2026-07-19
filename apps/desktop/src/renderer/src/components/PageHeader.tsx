import React from "react";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.text}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  text: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  title: { ...typography.title, color: colors.secondary, margin: 0 },
  subtitle: { ...typography.body, color: colors.textMuted, margin: 0 },
};
