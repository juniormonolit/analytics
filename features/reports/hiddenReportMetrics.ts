/**
 * Legacy helpers — report UI visibility is configured in Settings
 * (`features/settings/metricUiVisibility.ts`). Repeat-scope duplicate
 * metrics stay permanently hidden.
 */
import {
  isAlwaysHiddenFromReportUi,
  isVisibleInReportUi,
  readMetricUiVisibilityMap,
  type MetricUiVisibilityMap,
} from "@/features/settings/metricUiVisibility";
import { normalizeMetricIdForDealScope } from "@/features/reports/engine/dealScope";

export function isHiddenReportMetric(metricId: string): boolean {
  return isAlwaysHiddenFromReportUi(metricId);
}

export function filterVisibleReportMetrics<T extends { id: string }>(
  metrics: ReadonlyArray<T>,
  overrides: MetricUiVisibilityMap = readMetricUiVisibilityMap(),
): T[] {
  return metrics.filter((metric) =>
    isVisibleInReportUi(metric.id, overrides),
  );
}

export function stripHiddenReportMetricIds(metricIds: string[]): string[] {
  const overrides = readMetricUiVisibilityMap();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawId of metricIds) {
    if (isAlwaysHiddenFromReportUi(rawId)) continue;
    const id = normalizeMetricIdForDealScope(rawId);
    if (!isVisibleInReportUi(id, overrides) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
