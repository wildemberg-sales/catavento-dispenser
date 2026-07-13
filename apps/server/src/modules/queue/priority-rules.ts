import type { SourceType } from "@catavento/contracts/queue";

export function resolvePriority(
  source: SourceType,
  priorityOverride: number | null,
  rules: Map<string, number>
): number {
  if (priorityOverride !== null) {
    return priorityOverride;
  }
  return rules.get(source) ?? 0;
}
