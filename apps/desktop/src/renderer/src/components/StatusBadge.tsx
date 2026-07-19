import React from "react";
import { colors } from "../theme/colors";

const STATUS_TONES = colors.status as Record<string, { fg: string; bg: string }>;
const FALLBACK_TONE = { fg: colors.textMuted, bg: colors.neutralSoft };

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? FALLBACK_TONE;
  return (
    <span className="badge" style={{ color: tone.fg, backgroundColor: tone.bg }}>
      {status}
    </span>
  );
}
