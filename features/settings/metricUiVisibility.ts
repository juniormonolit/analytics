import {
  isRepeatScopeMetricId,
  normalizeMetricIdForDealScope,
} from "@/features/reports/engine/dealScope";

export const METRIC_UI_VISIBILITY_STORAGE_KEY = "bi.metrics.uiVisibility.v1";

/** Metrics replaced by the global primary/repeat switch — never shown in UI. */
export function isAlwaysHiddenFromReportUi(metricId: string): boolean {
  return isRepeatScopeMetricId(metricId);
}

export type MetricUiVisibilityMap = Record<string, boolean>;

/** Default visibility when the user has not overridden a metric in Settings. */
export function defaultVisibleInReportUi(metricId: string): boolean {
  return !isAlwaysHiddenFromReportUi(metricId);
}

export function isVisibleInReportUi(
  metricId: string,
  overrides: MetricUiVisibilityMap,
): boolean {
  if (isAlwaysHiddenFromReportUi(metricId)) return false;
  const id = normalizeMetricIdForDealScope(metricId);
  if (Object.prototype.hasOwnProperty.call(overrides, id)) {
    return overrides[id] === true;
  }
  return defaultVisibleInReportUi(metricId);
}

export function filterMetricsForReportUi<T extends { id: string }>(
  metrics: ReadonlyArray<T>,
  overrides: MetricUiVisibilityMap,
): T[] {
  return metrics.filter((metric) =>
    isVisibleInReportUi(metric.id, overrides),
  );
}

export function hiddenMetricIdsForReportUi(
  metrics: ReadonlyArray<{ id: string }>,
  overrides: MetricUiVisibilityMap,
): string[] {
  return metrics
    .filter((metric) => !isVisibleInReportUi(metric.id, overrides))
    .map((metric) => metric.id);
}

export function readMetricUiVisibilityMap(): MetricUiVisibilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(METRIC_UI_VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MetricUiVisibilityMap;
  } catch {
    return {};
  }
}

export function writeMetricUiVisibilityMap(map: MetricUiVisibilityMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      METRIC_UI_VISIBILITY_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // ignore quota / private mode
  }
}
