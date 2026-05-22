import "server-only";

/**
 * Server-side deal loading for metric-scoped drill-down.
 */
import {
  loadCalledStageIds,
} from "@/features/reports/engine/dimensions/calledDeals";
import {
  loadEventDealIdsInPeriod,
} from "@/features/reports/engine/dimensions/dealEventMetrics";
import {
  loadDealMilestoneDealIdsInPeriod,
} from "@/features/reports/engine/dimensions/dealsMilestoneMetrics";
import {
  filterDealsByFunnelKind,
  loadRepeatFunnelIds,
  periodEndExclusiveIso,
  periodStartIso,
  resolveManagerIdAliases,
} from "@/features/reports/engine/dimensions/primaryRepeatDeals";
import {
  DEFAULT_DEAL_SCOPE,
  type DealScope,
} from "@/features/reports/engine/dealScope";
import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { getDealMetricFilterSpec } from "./dealMetricSpecs";

type DealProjection = {
  deal_id: number;
  funnel_id: number;
};

async function loadDealsForPeriodFilter(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number | undefined,
): Promise<DealProjection[]> {
  const managerAliases =
    managerId !== undefined
      ? await resolveManagerIdAliases(supabase, managerId)
      : null;

  let query = supabase
    .from("deals")
    .select("deal_id, funnel_id")
    .gte("created_at", periodStartIso(period))
    .lt("created_at", periodEndExclusiveIso(period));

  if (managerAliases) {
    query = query.in("current_manager_id", managerAliases);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`deals lookup failed: ${error.message}`);
  }

  return (data ?? []) as DealProjection[];
}

async function loadCalledEventDealIds(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number | undefined,
  dealScope: DealScope,
): Promise<number[]> {
  const calledStageIds = await loadCalledStageIds(supabase);
  const managerAliases =
    managerId !== undefined
      ? await resolveManagerIdAliases(supabase, managerId)
      : undefined;

  return loadEventDealIdsInPeriod(
    supabase,
    period,
    calledStageIds,
    dealScope,
    managerAliases,
  );
}

async function loadMatchingDealIds(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number | undefined,
  metricId: string | undefined,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<number[]> {
  const spec = getDealMetricFilterSpec(metricId);
  if (!spec) return [];

  if (spec.kind === "deal_events") {
    return loadCalledEventDealIds(supabase, period, managerId, dealScope);
  }

  if (spec.kind === "milestone_date") {
    const managerAliases =
      managerId !== undefined
        ? await resolveManagerIdAliases(supabase, managerId)
        : undefined;
    return loadDealMilestoneDealIdsInPeriod(
      supabase,
      period,
      spec.dateColumn,
      dealScope,
      managerAliases,
    );
  }

  const [deals, repeatFunnelIds] = await Promise.all([
    loadDealsForPeriodFilter(supabase, period, managerId),
    dealScope === "all" ? Promise.resolve(null) : loadRepeatFunnelIds(supabase),
  ]);

  if (spec.kind === "funnel") {
    if (dealScope === "all") {
      return deals.map((deal) => deal.deal_id);
    }
    const funnelKind = dealScope;
    if (!repeatFunnelIds) {
      return [];
    }
    return filterDealsByFunnelKind(deals, repeatFunnelIds, funnelKind).map(
      (deal) => deal.deal_id,
    );
  }

  return [];
}

/** Distinct deal ids for a manager in a period, filtered by metric rule. */
export async function loadManagerPeriodDealIdsForMetric(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  metricId: string | undefined,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<number[]> {
  return loadMatchingDealIds(
    supabase,
    period,
    managerId,
    metricId,
    dealScope,
  );
}

/** Distinct deal ids in a period (optional manager), filtered by metric rule. */
export async function loadPeriodDealIdsForMetric(
  supabase: ServerSupabaseClient,
  period: Period,
  metricId: string | undefined,
  managerId?: number,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<number[]> {
  return loadMatchingDealIds(
    supabase,
    period,
    managerId,
    metricId,
    dealScope,
  );
}
