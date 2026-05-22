import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { DealScope } from "@/features/reports/engine/dealScope";

import {
  loadDealMilestoneAmountsByManager,
  loadDealMilestoneCountsByManager,
  loadDealMilestoneDealIdsInPeriod,
} from "./dealsMilestoneMetrics";

/** «Продажи» — count. */
export const PRIMARY_SALES_COUNT_METRIC_ID = "primary_sales_count";

/** «Сумма продаж». */
export const PRIMARY_SALES_AMOUNT_METRIC_ID = "primary_sales_amount";

/** «Отгрузки» — count. */
export const PRIMARY_SHIPMENTS_COUNT_METRIC_ID = "primary_shipments_count";

/** «Сумма отгрузок». */
export const PRIMARY_SHIPMENTS_AMOUNT_METRIC_ID = "primary_shipments_amount";

export const REPEAT_SALES_COUNT_METRIC_ID = "repeat_sales_count";
export const REPEAT_SALES_AMOUNT_METRIC_ID = "repeat_sales_amount";
export const REPEAT_SHIPMENTS_AMOUNT_METRIC_ID = "repeat_shipments_amount";

export type SalesShipmentsByManager = {
  salesCount: Map<number, number>;
  salesAmount: Map<number, number>;
  shipmentsCount: Map<number, number>;
  shipmentsAmount: Map<number, number>;
};

const SALES_COUNT_IDS = new Set([
  PRIMARY_SALES_COUNT_METRIC_ID,
  REPEAT_SALES_COUNT_METRIC_ID,
]);

const SALES_AMOUNT_IDS = new Set([
  PRIMARY_SALES_AMOUNT_METRIC_ID,
  REPEAT_SALES_AMOUNT_METRIC_ID,
]);

const SHIPMENTS_COUNT_IDS = new Set([PRIMARY_SHIPMENTS_COUNT_METRIC_ID]);

const SHIPMENTS_AMOUNT_IDS = new Set([
  PRIMARY_SHIPMENTS_AMOUNT_METRIC_ID,
  REPEAT_SHIPMENTS_AMOUNT_METRIC_ID,
]);

const ALL_SALES_SHIPMENTS_IDS = new Set([
  ...SALES_COUNT_IDS,
  ...SALES_AMOUNT_IDS,
  ...SHIPMENTS_COUNT_IDS,
  ...SHIPMENTS_AMOUNT_IDS,
]);

const SALES_SOURCE_COLUMNS = new Set([
  PRIMARY_SALES_COUNT_METRIC_ID,
  PRIMARY_SALES_AMOUNT_METRIC_ID,
  REPEAT_SALES_COUNT_METRIC_ID,
  REPEAT_SALES_AMOUNT_METRIC_ID,
]);

const SHIPMENTS_SOURCE_COLUMNS = new Set([
  PRIMARY_SHIPMENTS_COUNT_METRIC_ID,
  PRIMARY_SHIPMENTS_AMOUNT_METRIC_ID,
  REPEAT_SHIPMENTS_AMOUNT_METRIC_ID,
]);

export function isSalesCountMetricId(id: string): boolean {
  return SALES_COUNT_IDS.has(id);
}

export function isSalesAmountMetricId(id: string): boolean {
  return SALES_AMOUNT_IDS.has(id);
}

export function isShipmentsCountMetricId(id: string): boolean {
  return SHIPMENTS_COUNT_IDS.has(id);
}

export function isShipmentsAmountMetricId(id: string): boolean {
  return SHIPMENTS_AMOUNT_IDS.has(id);
}

export function isSalesShipmentsMetricId(id: string): boolean {
  return ALL_SALES_SHIPMENTS_IDS.has(id);
}

export function needsSalesShipmentsFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return metrics.some(
    (m) =>
      isSalesShipmentsMetricId(m.id) ||
      (m.source_column != null &&
        (SALES_SOURCE_COLUMNS.has(m.source_column) ||
          SHIPMENTS_SOURCE_COLUMNS.has(m.source_column))),
  );
}

export function needsSalesCountFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return metrics.some(
    (m) =>
      isSalesCountMetricId(m.id) ||
      (m.source_column != null && SALES_COUNT_IDS.has(m.source_column)),
  );
}

export function needsSalesAmountFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return metrics.some(
    (m) =>
      isSalesAmountMetricId(m.id) ||
      (m.source_column != null && SALES_AMOUNT_IDS.has(m.source_column)),
  );
}

export function needsShipmentsCountFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return metrics.some(
    (m) =>
      isShipmentsCountMetricId(m.id) ||
      (m.source_column != null && SHIPMENTS_COUNT_IDS.has(m.source_column)),
  );
}

export function needsShipmentsAmountFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return metrics.some(
    (m) =>
      isShipmentsAmountMetricId(m.id) ||
      (m.source_column != null && SHIPMENTS_AMOUNT_IDS.has(m.source_column)),
  );
}

/**
 * Aggregate sales / shipments per manager from `deals.sold_at` and
 * `deals.delivered_at` in the requested period.
 */
export async function loadSalesShipmentsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
): Promise<SalesShipmentsByManager> {
  const [salesCount, salesAmount, shipmentsCount, shipmentsAmount] =
    await Promise.all([
      loadDealMilestoneCountsByManager(supabase, period, "sold_at", dealScope),
      loadDealMilestoneAmountsByManager(supabase, period, "sold_at", dealScope),
      loadDealMilestoneCountsByManager(
        supabase,
        period,
        "delivered_at",
        dealScope,
      ),
      loadDealMilestoneAmountsByManager(
        supabase,
        period,
        "delivered_at",
        dealScope,
      ),
    ]);

  return {
    salesCount,
    salesAmount,
    shipmentsCount,
    shipmentsAmount,
  };
}

/** Distinct deal ids whose `sold_at` falls in the period. */
export async function loadSalesDealIdsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
  managerAliases?: ReadonlyArray<number>,
): Promise<number[]> {
  return loadDealMilestoneDealIdsInPeriod(
    supabase,
    period,
    "sold_at",
    dealScope,
    managerAliases,
  );
}

/** Distinct deal ids whose `delivered_at` falls in the period. */
export async function loadShipmentsDealIdsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
  managerAliases?: ReadonlyArray<number>,
): Promise<number[]> {
  return loadDealMilestoneDealIdsInPeriod(
    supabase,
    period,
    "delivered_at",
    dealScope,
    managerAliases,
  );
}
