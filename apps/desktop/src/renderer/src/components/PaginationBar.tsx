import React from "react";
import { Button } from "./Button";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type PaginationBarProps = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  testIdPrefix?: string;
  variant?: "secondary" | "ghost";
  showTotal?: boolean;
  hideWhenSinglePage?: boolean;
};

export function PaginationBar({
  page,
  total,
  pageSize,
  onChange,
  testIdPrefix = "page",
  variant = "secondary",
  showTotal = false,
  hideWhenSinglePage = false,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (hideWhenSinglePage && total <= pageSize) return null;

  return (
    <div style={styles.container}>
      <Button
        data-testid={`${testIdPrefix}-prev`}
        variant={variant}
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <span style={styles.label} data-testid={`${testIdPrefix}-label`}>
        Página {page} de {totalPages}
        {showTotal ? ` (${total} no total)` : ""}
      </span>
      <Button
        data-testid={`${testIdPrefix}-next`}
        variant={variant}
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "12px 0 0" },
  label: { ...typography.label, color: colors.textMuted },
};
