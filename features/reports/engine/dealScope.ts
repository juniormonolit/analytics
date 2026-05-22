/**
 * Global primary / repeat / all deal filter for the report engine.
 *
 * Applied before any metric aggregation so every column reflects the
 * same funnel scope selected in the toolbar.
 */
import type { FunnelKind } from "./dimensions/primaryRepeatDeals";

export type DealScope = FunnelKind | "all";

export const DEFAULT_DEAL_SCOPE: DealScope = "primary";

/** Metrics that duplicate a primary_* row — hidden from picker / all_core. */
export const REPEAT_SCOPE_METRIC_IDS: ReadonlySet<string> = new Set([
  "repeat_deals_count",
  "repeat_sales_count",
  "repeat_sales_amount",
  "repeat_shipments_amount",
]);

/** Legacy saved prefs may reference repeat_* ids — map to primary counterparts. */
export const REPEAT_TO_PRIMARY_METRIC_ID: Readonly<Record<string, string>> = {
  repeat_deals_count: "primary_deals_count",
  repeat_sales_count: "primary_sales_count",
  repeat_sales_amount: "primary_sales_amount",
  repeat_shipments_amount: "primary_shipments_amount",
};

export function normalizeMetricIdForDealScope(metricId: string): string {
  return REPEAT_TO_PRIMARY_METRIC_ID[metricId] ?? metricId;
}

export function isRepeatScopeMetricId(id: string): boolean {
  return REPEAT_SCOPE_METRIC_IDS.has(id);
}

/** Maps a primary daily_sales / catalog column to its repeat counterpart. */
const PRIMARY_TO_REPEAT_COLUMN: Readonly<Record<string, string>> = {
  primary_sales_count: "repeat_sales_count",
  primary_sales_amount: "repeat_sales_amount",
  primary_shipments_amount: "repeat_shipments_amount",
};

export function stripDealScopeSuffix(label: string): string {
  return label
    .replace(/\s*\(перв\.\)\s*$/iu, "")
    .replace(/\s*\(повт\.\)\s*$/iu, "")
    .trim();
}

/**
 * When aggregating `daily_sales`, skip columns that are merged elsewhere
 * or belong to the opposite funnel scope.
 */
export function shouldSkipDailySalesColumnForScope(
  col: string,
  dealScope: DealScope,
): boolean {
  if (dealScope === "all") {
    return col.startsWith("repeat_");
  }
  if (dealScope === "primary") {
    return col.startsWith("repeat_");
  }
  return col.startsWith("primary_") || col === "incoming_deals_count";
}

/**
 * Resolve a catalog `source_column` value from summed daily_sales buckets.
 */
export function resolveDailySalesColumnValue(
  columnSums: Readonly<Record<string, number>>,
  sourceColumn: string,
  dealScope: DealScope,
): number {
  if (dealScope === "all") {
    if (sourceColumn.startsWith("primary_")) {
      const repeatCol = PRIMARY_TO_REPEAT_COLUMN[sourceColumn];
      return (
        (columnSums[sourceColumn] ?? 0) +
        (repeatCol ? (columnSums[repeatCol] ?? 0) : 0)
      );
    }
    if (sourceColumn.startsWith("repeat_")) {
      return 0;
    }
    return columnSums[sourceColumn] ?? 0;
  }

  if (dealScope === "repeat") {
    if (sourceColumn.startsWith("primary_")) {
      const repeatCol = PRIMARY_TO_REPEAT_COLUMN[sourceColumn];
      return repeatCol ? (columnSums[repeatCol] ?? 0) : 0;
    }
    return columnSums[sourceColumn] ?? 0;
  }

  if (sourceColumn.startsWith("repeat_")) {
    return 0;
  }
  return columnSums[sourceColumn] ?? 0;
}

/** Drill-down and deal loaders: global scope overrides per-metric funnelKind. */
export function effectiveFunnelKindForScope(
  dealScope: DealScope,
  metricFunnelKind: FunnelKind | undefined,
): FunnelKind | undefined {
  if (dealScope === "all") return undefined;
  void metricFunnelKind;
  return dealScope;
}
