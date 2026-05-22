import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { DealScope } from "@/features/reports/engine/dealScope";
import { metricsReferenceId } from "@/features/reports/engine/metricReferences";

import {
  loadEventDealCountsByManager,
  loadStageIdsByEventType,
} from "./dealEventMetrics";

/** «Созвонился» — distinct deals with a called event in the period. */
export const CALLED_DEALS_METRIC_ID = "called_deals_count";

export function isCalledDealsMetricId(id: string): boolean {
  return id === CALLED_DEALS_METRIC_ID;
}

export function needsCalledDealsFromDeals(
  metrics: ReadonlyArray<{
    id: string;
    source_column?: string | null;
    dependencies?: string[] | null;
  }>,
): boolean {
  return metricsReferenceId(metrics, CALLED_DEALS_METRIC_ID);
}

export async function loadCalledStageIds(
  supabase: ServerSupabaseClient,
): Promise<Set<string>> {
  return loadStageIdsByEventType(supabase, "called");
}

/** Distinct called deal counts per manager (`deal_events.event_at` in period). */
export async function loadCalledDealsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  const calledStageIds = await loadCalledStageIds(supabase);
  if (calledStageIds.size === 0) {
    return new Map();
  }

  return loadEventDealCountsByManager(
    supabase,
    period,
    calledStageIds,
    dealScope,
  );
}
