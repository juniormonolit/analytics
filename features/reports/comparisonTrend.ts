import { formatDeltaPercent } from "@/lib/format/delta";

import { getDeltaColor, type DeltaColor } from "./colorRules";
import type { MetricColumn } from "./engine/types";

const MINUS = "\u2212";

export type ComparisonCell = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
};

/** Relative growth is undefined when the comparison base is exactly zero. */
export function isGrowthFromZero(cell: ComparisonCell): boolean {
  return (
    cell.previous === 0 &&
    cell.current !== null &&
    cell.current !== 0 &&
    cell.delta !== null &&
    cell.delta !== 0 &&
    cell.deltaPercent === null
  );
}

/**
 * Color for Δ / Δ% columns. Uses deltaPercent when defined; otherwise
 * falls back to the delta sign (e.g. current > 0 with previous = 0).
 */
export function getComparisonDeltaColor(
  metric: Pick<MetricColumn, "id">,
  cell: ComparisonCell,
): DeltaColor {
  const fromPercent = getDeltaColor(metric, cell.deltaPercent);
  if (fromPercent !== null) return fromPercent;

  if (cell.delta === null || !Number.isFinite(cell.delta)) return null;
  if (cell.delta > 0) return getDeltaColor(metric, 1);
  if (cell.delta < 0) return getDeltaColor(metric, -1);
  return "neutral";
}

export function formatComparisonGrowthPercent(
  cell: ComparisonCell,
  decimalPlaces = 1,
): string {
  if (cell.deltaPercent !== null && Number.isFinite(cell.deltaPercent)) {
    return formatDeltaPercent(cell.deltaPercent, { decimalPlaces });
  }
  if (isGrowthFromZero(cell)) {
    return cell.delta! > 0 ? "+∞" : `${MINUS}∞`;
  }
  return formatDeltaPercent(null);
}

export function comparisonGrowthHasTrend(cell: ComparisonCell): boolean {
  if (cell.deltaPercent !== null && Number.isFinite(cell.deltaPercent)) {
    return true;
  }
  return isGrowthFromZero(cell);
}
