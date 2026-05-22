/**
 * Report engine types — shared by the API route, the engine pipeline,
 * and the future TanStack-Query consumer in the UI.
 *
 * Two layers of types live here:
 *
 * 1. **Public shapes** (`RunReportRequest`, `RunReportResponse`,
 *    `MetricColumn`, `Row`, `MetricCell`, `DimensionColumn`) — the wire
 *    contract documented in `ai_docs/03_REPORT_ENGINE.md`.
 *
 * 2. **Internal pipeline shapes** (`IntermediateRow`, `MergedRow`,
 *    `RawAggregates`) — used by the pure aggregate / merge / totals /
 *    grouping helpers so callers don't have to care about how raw column
 *    sums are kept around for ratio recomputation.
 */
import type { Period } from "@/lib/period/types";

import type { DealScope } from "./dealScope";

export type { DealScope };

/**
 * Each item is either a real `sa.metrics.id` or the special token
 * `"all_core"` which expands to "every core metric in the catalog".
 */
export type MetricInputId = string;

export type ReportSlug = "by-managers" | "by-product-groups";
export type Grouping = "none" | "team" | "total";

export type RunReportRequest = {
  sectionSlug: "sales";
  reportSlug: ReportSlug;
  period: Period;
  comparisonPeriod: Period;
  filters: { teamIds?: string[] };
  metricIds: MetricInputId[];
  grouping: Grouping;
  /** Primary / repeat / all funnel filter. Default: `"primary"`. */
  /** Metric ids hidden from report UI via Settings (client-local). */
  uiHiddenMetricIds?: string[];
};

export type MetricDataType = "int" | "decimal" | "money" | "percent" | "months";
export type MetricAggregationFn = "sum" | "avg" | "none";

export type MetricColumn = {
  id: string;
  label: string;
  dataType: MetricDataType;
  decimalPlaces: number;
  aggregationFn: MetricAggregationFn;
  isCalculated: boolean;
  dependencies?: string[];
  formula?: string | null;
  category?: string | null;
};

export type DimensionColumn = {
  /** Field key in `Row.dimension` (e.g. `"manager_name"`). */
  key: string;
  /** Russian label rendered as the column header. */
  label: string;
};

export type MetricCell = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  /** `null` when previous is 0 or missing — UI renders `—`. */
  deltaPercent: number | null;
};

export type RowKind = "data" | "groupLabel" | "groupSubtotal" | "grandTotal";

export type Row = {
  /** Stable string id used as React key and merge key. */
  key: string;
  dimension: Record<string, string | number | null>;
  metrics: Record<string, MetricCell>;
  /**
   * Visual role when `grouping !== "none"`. Drives table layout:
   * - `groupLabel` — department title row
   * - `groupSubtotal` — aggregated values under a department block
   * - `grandTotal` — single-row totals in `grouping === "total"`
   */
  rowKind?: RowKind;
  /**
   * Set when `grouping === "team"`: the parent group's stable id and
   * label. Applies to label, member, and subtotal rows in the block.
   */
  groupKey?: string;
  groupLabel?: string;
};

export type RunReportResponse = {
  columns: {
    dimension: DimensionColumn[];
    metrics: MetricColumn[];
  };
  rows: Row[];
  /**
   * Single grand-totals row. `null` only when `grouping === "total"`,
   * because in that case the rows array already contains exactly the
   * totals and a separate `totals` field would be redundant.
   */
  totals: Row | null;
  meta: {
    period: Period;
    comparisonPeriod: Period;
  };
};

// ---------------------------------------------------------------------------
// Internal pipeline shapes (not part of the public response).
// ---------------------------------------------------------------------------

/** `metricId → summed source value` for a single intermediate bucket. */
export type RawAggregates = Record<string, number>;

/**
 * Output of `dimension.fetch()` — one entry per unique dimension key
 * for a single period. The `raw` map carries the per-metric column
 * sums the engine needs to compute final cells (and recompute
 * ratio/CR metrics during totals/grouping).
 */
export type IntermediateRow = {
  key: string;
  dimension: Record<string, string | number | null>;
  /** Number of source rows that contributed to this bucket. */
  count: number;
  raw: RawAggregates;
};

/**
 * Result of merging current-period and comparison-period intermediate
 * rows by their dimension key. Carries both raw maps so the totals/
 * grouping passes can recompute ratios from numerator/denominator.
 */
export type MergedRow = {
  key: string;
  dimension: Record<string, string | number | null>;
  currentCount: number;
  previousCount: number;
  currentRaw: RawAggregates;
  previousRaw: RawAggregates;
};
