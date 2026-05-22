import type { MetricSubKind } from "./sorting";

export const METRIC_SUB_HEADERS: ReadonlyArray<{
  kind: MetricSubKind;
  label: string;
}> = [
  { kind: "current", label: "Текущий" },
  { kind: "previous", label: "Сравнение" },
  { kind: "delta", label: "Δ" },
  { kind: "deltaPercent", label: "Δ%" },
];

export function metricSubHeadersForDisplay(
  showComparison: boolean,
): ReadonlyArray<{ kind: MetricSubKind; label: string }> {
  return showComparison
    ? METRIC_SUB_HEADERS
    : [{ kind: "current", label: "Текущий" }];
}

export function metricColumnSpan(showComparison: boolean): number {
  return showComparison ? 4 : 1;
}
