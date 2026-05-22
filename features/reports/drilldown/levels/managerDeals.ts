import "server-only";

/**
 * Shared deal fetching for drill-down levels scoped to a manager.
 *
 * Deal sets follow the clicked report metric (`metricId` on the request):
 * funnel split (primary / repeat) or stage `event_type`, same rules as
 * the main report engine.
 */
import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

import type { DealScope } from "@/features/reports/engine/dealScope";
import { DEFAULT_DEAL_SCOPE } from "@/features/reports/engine/dealScope";

import { loadManagerPeriodDealIdsForMetric } from "../dealMetricFilter";
import { resolveManagerIdAliases } from "@/features/reports/engine/dimensions/primaryRepeatDeals";

type DealRow = Database["sa"]["Tables"]["deals"]["Row"];

export type ManagerDealProjection = Pick<
  DealRow,
  "deal_id" | "product_group_id" | "amount" | "team_id" | "created_at"
>;

/** Deal ids for a manager in a period, filtered by metric rule. */
export async function loadManagerPeriodDealIds(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  metricId?: string,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<number[]> {
  return loadManagerPeriodDealIdsForMetric(
    supabase,
    period,
    managerId,
    metricId,
    dealScope,
  );
}

/**
 * Deals for a manager in a period — same deal set as the clicked metric
 * in the main report.
 */
export async function fetchDealsForManagerByMetric(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  columns: string,
  metricId?: string,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<ManagerDealProjection[]> {
  const managerAliases = await resolveManagerIdAliases(supabase, managerId);
  const dealIds = await loadManagerPeriodDealIdsForMetric(
    supabase,
    period,
    managerId,
    metricId,
    dealScope,
  );
  if (dealIds.length === 0) return [];

  const { data, error } = await supabase
    .from("deals")
    .select(columns)
    .in("deal_id", dealIds)
    .in("current_manager_id", managerAliases);

  if (error) {
    throw new Error(`drilldown deals query failed: ${error.message}`);
  }

  return (data ?? []) as ManagerDealProjection[];
}

/** @deprecated Use `fetchDealsForManagerByMetric`. */
export async function fetchPrimaryDealsForManager(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  columns: string,
  metricId?: string,
): Promise<ManagerDealProjection[]> {
  return fetchDealsForManagerByMetric(
    supabase,
    period,
    managerId,
    columns,
    metricId,
  );
}

/** @deprecated Use `fetchDealsForManagerByMetric`. */
export async function fetchIncomingDealsForManager(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  columns: string,
): Promise<ManagerDealProjection[]> {
  return fetchDealsForManagerByMetric(
    supabase,
    period,
    managerId,
    columns,
    "primary_deals_count",
  );
}

/** @deprecated Use `fetchDealsForManagerByMetric`. */
export async function fetchManagerDealsForPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  columns: string,
): Promise<ManagerDealProjection[]> {
  return fetchDealsForManagerByMetric(
    supabase,
    period,
    managerId,
    columns,
    "primary_deals_count",
  );
}
