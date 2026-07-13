export function calculateDurationSeconds(startedAt: Date, completedAt: Date): number {
  const diffMs = completedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.round(diffMs / 1000));
}
