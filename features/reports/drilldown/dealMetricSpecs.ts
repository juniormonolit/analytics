/**
 * Deal-level drill-down rules keyed by report metric id.
 * Shared between the UI (clickable cells) and server handlers.
 */
import type { DealMilestoneDateColumn } from "@/features/reports/engine/dimensions/dealsMilestoneMetrics";
import type { HistoricalStageEventType } from "@/features/reports/engine/dimensions/reservationDeals";
import { normalizeMetricIdForDealScope } from "@/features/reports/engine/dealScope";
import type { FunnelKind } from "@/features/reports/engine/dimensions/primaryRepeatDeals";

/** Default when `metricId` is omitted (legacy drill-down requests). */
export const DEFAULT_DRILLDOWN_METRIC_ID = "primary_deals_count";

export type DealMetricFilterSpec =
  | { kind: "funnel"; funnelKind: FunnelKind }
  | { kind: "deal_events"; eventType: Extract<HistoricalStageEventType, "called"> }
  | { kind: "milestone_date"; dateColumn: DealMilestoneDateColumn };

export const DEAL_METRIC_FILTER_SPECS: Readonly<
  Record<string, DealMetricFilterSpec>
> = {
  primary_deals_count: { kind: "funnel", funnelKind: "primary" },
  incoming_deals_count: { kind: "funnel", funnelKind: "primary" },
  repeat_deals_count: { kind: "funnel", funnelKind: "repeat" },
  called_deals_count: { kind: "deal_events", eventType: "called" },
  reservations_count: { kind: "milestone_date", dateColumn: "reserved_at" },
  confirmed_reservations_count: {
    kind: "milestone_date",
    dateColumn: "confirmed_at",
  },
  primary_sales_count: { kind: "milestone_date", dateColumn: "sold_at" },
  primary_sales_amount: { kind: "milestone_date", dateColumn: "sold_at" },
  repeat_sales_count: { kind: "milestone_date", dateColumn: "sold_at" },
  repeat_sales_amount: { kind: "milestone_date", dateColumn: "sold_at" },
  primary_shipments_count: {
    kind: "milestone_date",
    dateColumn: "delivered_at",
  },
  primary_shipments_amount: {
    kind: "milestone_date",
    dateColumn: "delivered_at",
  },
  repeat_shipments_amount: {
    kind: "milestone_date",
    dateColumn: "delivered_at",
  },
};

export function resolveDrilldownMetricId(metricId: string | undefined): string {
  return metricId ?? DEFAULT_DRILLDOWN_METRIC_ID;
}

export function getDealMetricFilterSpec(
  metricId: string | undefined,
): DealMetricFilterSpec | null {
  const resolved = normalizeMetricIdForDealScope(
    resolveDrilldownMetricId(metricId),
  );
  return DEAL_METRIC_FILTER_SPECS[resolved] ?? null;
}

export function isDrillableDealMetric(metricId: string): boolean {
  return metricId in DEAL_METRIC_FILTER_SPECS;
}
