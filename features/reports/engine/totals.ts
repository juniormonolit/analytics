/**
 * Totals row computation.
 *
 * Critical rule: ratio / CR metrics are never averaged across rows.
 * Instead we sum each row's underlying numerator and denominator
 * (kept in `MergedRow.currentRaw` / `previousRaw`) and recompute the
 * ratio at the totals level — same code path as for individual rows,
 * just with summed inputs. This is how we get correct CRs at the
 * totals row even when the per-row ratios vary widely.
 */
import { buildMetricCells, sumRaw } from "./aggregate";
import type { MetricRow } from "./metricsCatalog";
import type { MergedRow, RawAggregates, Row } from "./types";

export type AggregatedBucket = {
  currentCount: number;
  previousCount: number;
  currentRaw: RawAggregates;
  previousRaw: RawAggregates;
};

/** Sum the raw aggregates and counts of an arbitrary set of rows. */
export function aggregateMergedRows(rows: MergedRow[]): AggregatedBucket {
  let currentCount = 0;
  let previousCount = 0;
  let currentRaw: RawAggregates = {};
  let previousRaw: RawAggregates = {};

  for (const r of rows) {
    currentCount += r.currentCount;
    previousCount += r.previousCount;
    currentRaw = sumRaw(currentRaw, r.currentRaw);
    previousRaw = sumRaw(previousRaw, r.previousRaw);
  }

  return { currentCount, previousCount, currentRaw, previousRaw };
}

/** Build the grand-totals output row across all merged rows. */
export function computeTotalsRow(
  rows: MergedRow[],
  metrics: MetricRow[],
): Row {
  const agg = aggregateMergedRows(rows);
  return {
    key: "__totals__",
    dimension: {},
    metrics: buildMetricCells(
      metrics,
      agg.currentRaw,
      agg.previousRaw,
      agg.currentCount,
      agg.previousCount,
    ),
  };
}
