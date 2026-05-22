/** Whether any requested metric directly or via `dependencies` uses `targetId`. */
export function metricsReferenceId(
  metrics: ReadonlyArray<{
    id: string;
    source_column?: string | null;
    dependencies?: string[] | null;
  }>,
  targetId: string,
): boolean {
  for (const metric of metrics) {
    if (metric.id === targetId || metric.source_column === targetId) {
      return true;
    }
    if ((metric.dependencies ?? []).includes(targetId)) {
      return true;
    }
  }
  return false;
}
