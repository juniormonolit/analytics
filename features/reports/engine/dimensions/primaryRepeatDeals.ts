import { addDays } from "date-fns";

import type { DealScope } from "@/features/reports/engine/dealScope";
import { metricsReferenceId } from "@/features/reports/engine/metricReferences";
import { fromIso, toIso } from "@/lib/period/defaults";
import type { Period } from "@/lib/period/types";
import {
  buildManagerEmployeeAliasLookups,
  loadManagerEmployeeAliasesByManagerIds,
  resolveManagerIdAliasesFromOrg,
} from "@/lib/org/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/** Canonical metric id — «Первичные сделки». */
export const PRIMARY_DEALS_METRIC_ID = "primary_deals_count";

/** «Повторные сделки». */
export const REPEAT_DEALS_METRIC_ID = "repeat_deals_count";

/** @deprecated Use `PRIMARY_DEALS_METRIC_ID`. Kept for saved prefs / catalog rows. */
export const LEGACY_INCOMING_DEALS_METRIC_ID = "incoming_deals_count";

export type DealFunnelProjection = {
  deal_id: number;
  current_manager_id: number;
  funnel_id: number;
};

type EmployeeAliasRow = {
  id: string;
  bitrix_id: number | null;
};

export type FunnelKind = "primary" | "repeat";

export function isPrimaryDealsMetricId(id: string): boolean {
  return id === PRIMARY_DEALS_METRIC_ID || id === LEGACY_INCOMING_DEALS_METRIC_ID;
}

export function isRepeatDealsMetricId(id: string): boolean {
  return id === REPEAT_DEALS_METRIC_ID;
}

export function needsPrimaryDealsFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null; dependencies?: string[] | null }>,
): boolean {
  return (
    metricsReferenceId(metrics, PRIMARY_DEALS_METRIC_ID) ||
    metricsReferenceId(metrics, LEGACY_INCOMING_DEALS_METRIC_ID)
  );
}

export function needsRepeatDealsFromDeals(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null; dependencies?: string[] | null }>,
): boolean {
  return metricsReferenceId(metrics, REPEAT_DEALS_METRIC_ID);
}

export function needsFunnelBasedDealMetrics(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return (
    needsPrimaryDealsFromDeals(metrics) || needsRepeatDealsFromDeals(metrics)
  );
}

/** Half-open period: `[from 00:00:00, to+1 day 00:00:00)`. */
export function periodStartIso(period: Period): string {
  return `${period.from}T00:00:00`;
}

export function periodEndExclusiveIso(period: Period): string {
  return `${toIso(addDays(fromIso(period.to), 1))}T00:00:00`;
}

export function isPrimaryFunnel(
  funnelId: number,
  repeatFunnelIds: ReadonlySet<number>,
): boolean {
  return !repeatFunnelIds.has(funnelId);
}

export function isRepeatFunnel(
  funnelId: number,
  repeatFunnelIds: ReadonlySet<number>,
): boolean {
  return repeatFunnelIds.has(funnelId);
}

export function filterDealsByFunnelKind<
  T extends Pick<DealFunnelProjection, "deal_id" | "funnel_id">,
>(
  deals: ReadonlyArray<T>,
  repeatFunnelIds: ReadonlySet<number>,
  kind: FunnelKind,
): T[] {
  return deals.filter((deal) =>
    kind === "primary"
      ? isPrimaryFunnel(deal.funnel_id, repeatFunnelIds)
      : isRepeatFunnel(deal.funnel_id, repeatFunnelIds),
  );
}

export function filterDealsByDealScope<
  T extends Pick<DealFunnelProjection, "deal_id" | "funnel_id">,
>(
  deals: ReadonlyArray<T>,
  repeatFunnelIds: ReadonlySet<number>,
  dealScope: DealScope,
): T[] {
  if (dealScope === "all") return [...deals];
  return filterDealsByFunnelKind(deals, repeatFunnelIds, dealScope);
}

/**
 * Group distinct deal ids by `deals.current_manager_id` for one funnel kind.
 */
export function dealSetsByCurrentManager(
  deals: ReadonlyArray<Pick<DealFunnelProjection, "deal_id" | "current_manager_id">>,
): Map<number, Set<number>> {
  const managerToDealIds = new Map<number, Set<number>>();

  for (const deal of deals) {
    const managerId = Number(deal.current_manager_id);
    const dealId = Number(deal.deal_id);
    if (!Number.isFinite(managerId) || !Number.isFinite(dealId)) continue;

    let dealIds = managerToDealIds.get(managerId);
    if (!dealIds) {
      dealIds = new Set<number>();
      managerToDealIds.set(managerId, dealIds);
    }
    dealIds.add(dealId);
  }

  return managerToDealIds;
}

function buildEmployeeAliasLookups(rows: ReadonlyArray<EmployeeAliasRow>): {
  byBitrixId: Map<number, EmployeeAliasRow>;
  byId: Map<string, EmployeeAliasRow>;
} {
  return buildManagerEmployeeAliasLookups(rows);
}

export function canonicalManagerId(
  rawManagerId: number,
  byBitrixId: ReadonlyMap<number, EmployeeAliasRow>,
  byId: ReadonlyMap<string, EmployeeAliasRow>,
): number {
  const byBitrix = byBitrixId.get(rawManagerId);
  if (byBitrix?.bitrix_id != null) return byBitrix.bitrix_id;
  const byInternal = byId.get(String(rawManagerId));
  if (byInternal?.bitrix_id != null) return byInternal.bitrix_id;
  return rawManagerId;
}

export function mergeDealSetsToCanonicalManager(
  managerToDealIds: ReadonlyMap<number, Set<number>>,
  byBitrixId: ReadonlyMap<number, EmployeeAliasRow>,
  byId: ReadonlyMap<string, EmployeeAliasRow>,
): Map<number, number> {
  const merged = new Map<number, Set<number>>();

  for (const [rawManagerId, dealIds] of managerToDealIds) {
    const canonicalId = canonicalManagerId(rawManagerId, byBitrixId, byId);
    let bucket = merged.get(canonicalId);
    if (!bucket) {
      bucket = new Set<number>();
      merged.set(canonicalId, bucket);
    }
    for (const dealId of dealIds) bucket.add(dealId);
  }

  const result = new Map<number, number>();
  for (const [managerId, dealIds] of merged) {
    result.set(managerId, dealIds.size);
  }
  return result;
}

/** Bitrix id + internal org employee id for the same person. */
export async function resolveManagerIdAliases(
  _supabase: ServerSupabaseClient,
  managerId: number,
): Promise<number[]> {
  return resolveManagerIdAliasesFromOrg(managerId);
}

export async function loadRepeatFunnelIds(
  supabase: ServerSupabaseClient,
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("funnels")
    .select("id")
    .eq("is_repeat", true);

  if (error) {
    throw new Error(`funnels lookup failed: ${error.message}`);
  }

  return new Set(
    ((data ?? []) as Array<{ id: number }>).map((row) => row.id),
  );
}

export async function loadDealsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
): Promise<DealFunnelProjection[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("deal_id, current_manager_id, funnel_id")
    .gte("created_at", periodStartIso(period))
    .lt("created_at", periodEndExclusiveIso(period));

  if (error) {
    throw new Error(`deals lookup failed: ${error.message}`);
  }

  return (data ?? []) as DealFunnelProjection[];
}

async function loadDealCountsByManagerForKind(
  supabase: ServerSupabaseClient,
  period: Period,
  kind: FunnelKind,
): Promise<Map<number, number>> {
  const [repeatFunnelIds, deals] = await Promise.all([
    loadRepeatFunnelIds(supabase),
    loadDealsInPeriod(supabase, period),
  ]);

  const filtered = filterDealsByFunnelKind(deals, repeatFunnelIds, kind);
  const rawSets = dealSetsByCurrentManager(filtered);
  if (rawSets.size === 0) {
    return new Map();
  }

  const managerIds = Array.from(rawSets.keys());
  const employeeRows = await loadManagerEmployeeAliasesByManagerIds(managerIds);

  const { byBitrixId, byId } = buildEmployeeAliasLookups(employeeRows);

  return mergeDealSetsToCanonicalManager(rawSets, byBitrixId, byId);
}

/** Distinct primary deal counts per manager (`deals.created_at` in period). */
export async function loadPrimaryDealsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
): Promise<Map<number, number>> {
  return loadDealCountsByManagerForKind(supabase, period, "primary");
}

/** Distinct repeat deal counts per manager (`deals.created_at` in period). */
export async function loadRepeatDealsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
): Promise<Map<number, number>> {
  return loadDealCountsByManagerForKind(supabase, period, "repeat");
}

/** Distinct deal counts per manager for the global funnel scope. */
export async function loadScopedDealsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope,
): Promise<Map<number, number>> {
  if (dealScope === "primary") {
    return loadPrimaryDealsByManager(supabase, period);
  }
  if (dealScope === "repeat") {
    return loadRepeatDealsByManager(supabase, period);
  }

  const deals = await loadDealsInPeriod(supabase, period);
  const rawSets = dealSetsByCurrentManager(deals);
  if (rawSets.size === 0) {
    return new Map();
  }

  const managerIds = Array.from(rawSets.keys());
  const employeeRows = await loadManagerEmployeeAliasesByManagerIds(managerIds);

  const { byBitrixId, byId } = buildEmployeeAliasLookups(employeeRows);

  return mergeDealSetsToCanonicalManager(rawSets, byBitrixId, byId);
}

/**
 * Distinct primary deal ids for one manager in a period, attributed via
 * `deals.current_manager_id` (with id / bitrix_id aliases).
 */
export async function loadPrimaryDealIdsForManager(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
): Promise<number[]> {
  const [repeatFunnelIds, managerAliases] = await Promise.all([
    loadRepeatFunnelIds(supabase),
    resolveManagerIdAliases(supabase, managerId),
  ]);

  const { data, error } = await supabase
    .from("deals")
    .select("deal_id, funnel_id")
    .gte("created_at", periodStartIso(period))
    .lt("created_at", periodEndExclusiveIso(period))
    .in("current_manager_id", managerAliases);

  if (error) {
    throw new Error(`deals lookup failed: ${error.message}`);
  }

  const dealIds = new Set<number>();

  for (const row of (data ?? []) as Array<{
    deal_id: number;
    funnel_id: number;
  }>) {
    if (!isPrimaryFunnel(row.funnel_id, repeatFunnelIds)) continue;
    if (Number.isFinite(row.deal_id)) dealIds.add(row.deal_id);
  }

  return Array.from(dealIds);
}
