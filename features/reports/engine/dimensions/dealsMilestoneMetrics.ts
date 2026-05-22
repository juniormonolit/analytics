import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { loadEmployeeAliasLookupsForManagers } from "@/lib/org/repository";

import type { DealScope } from "@/features/reports/engine/dealScope";

import {
  amountsByEventManager,
  dealSetsByEventManager,
  filterDealIdsByDealScope,
  type PeriodDealEvent,
} from "./dealEventMetrics";
import {
  canonicalManagerId,
  mergeDealSetsToCanonicalManager,
  periodEndExclusiveIso,
  periodStartIso,
} from "./primaryRepeatDeals";

export type DealMilestoneDateColumn =
  | "sold_at"
  | "delivered_at"
  | "reserved_at"
  | "confirmed_at";

export type DealMilestoneMetricRow = {
  deal_id: number;
  current_manager_id: number;
  amount: number;
  funnel_id: number;
};

const DEALS_PAGE_SIZE = 1000;

type EmployeeAliasRow = {
  id: string;
  bitrix_id: number | null;
};

function toFiniteAmount(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function milestoneRowsToPeriodDealEvents(
  rows: ReadonlyArray<DealMilestoneMetricRow>,
): PeriodDealEvent[] {
  return rows.map((row) => ({
    deal_id: row.deal_id,
    manager_id: row.current_manager_id,
    stage_id: "",
    amount_at_event: row.amount,
    event_at: "",
  }));
}

function mergeAmountsToCanonicalManager(
  managerToAmount: ReadonlyMap<number, number>,
  byBitrixId: ReadonlyMap<number, EmployeeAliasRow>,
  byId: ReadonlyMap<string, EmployeeAliasRow>,
): Map<number, number> {
  const merged = new Map<number, number>();
  for (const [rawManagerId, amount] of managerToAmount) {
    const canonicalId = canonicalManagerId(rawManagerId, byBitrixId, byId);
    merged.set(canonicalId, (merged.get(canonicalId) ?? 0) + amount);
  }
  return merged;
}

async function mergeMilestoneRowsToCanonicalManager(
  rows: ReadonlyArray<DealMilestoneMetricRow>,
): Promise<{
  counts: Map<number, number>;
  amounts: Map<number, number>;
}> {
  const events = milestoneRowsToPeriodDealEvents(rows);
  const rawCounts = dealSetsByEventManager(events);
  const rawAmounts = amountsByEventManager(events);

  const managerIds = Array.from(
    new Set([...rawCounts.keys(), ...rawAmounts.keys()]),
  );

  if (managerIds.length === 0) {
    return { counts: new Map(), amounts: new Map() };
  }

  const { byBitrixId, byId } =
    await loadEmployeeAliasLookupsForManagers(managerIds);

  return {
    counts: mergeDealSetsToCanonicalManager(rawCounts, byBitrixId, byId),
    amounts: mergeAmountsToCanonicalManager(rawAmounts, byBitrixId, byId),
  };
}

/**
 * Load deals whose milestone date column falls in the requested period.
 * Manager and amount are taken from `deals`.
 */
export async function loadDealsByMilestoneDateInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  dateColumn: DealMilestoneDateColumn,
  dealScope: DealScope = "primary",
  managerAliases?: ReadonlyArray<number>,
): Promise<DealMilestoneMetricRow[]> {
  const rows: DealMilestoneMetricRow[] = [];

  for (let offset = 0; ; offset += DEALS_PAGE_SIZE) {
    let query = supabase
      .from("deals")
      .select("deal_id, current_manager_id, amount, funnel_id")
      .gte(dateColumn, periodStartIso(period))
      .lt(dateColumn, periodEndExclusiveIso(period))
      .range(offset, offset + DEALS_PAGE_SIZE - 1);

    if (managerAliases && managerAliases.length > 0) {
      query = query.in("current_manager_id", [...managerAliases]);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`deals lookup failed: ${error.message}`);
    }

    const page = (data ?? []) as Array<{
      deal_id: number;
      current_manager_id: number;
      amount: number | null;
      funnel_id: number;
    }>;

    for (const row of page) {
      if (!Number.isFinite(row.deal_id) || row.current_manager_id == null) continue;
      rows.push({
        deal_id: row.deal_id,
        current_manager_id: row.current_manager_id,
        amount: toFiniteAmount(row.amount),
        funnel_id: row.funnel_id,
      });
    }

    if (page.length < DEALS_PAGE_SIZE) break;
  }

  if (rows.length === 0) return [];

  const allowedDealIds = await filterDealIdsByDealScope(
    supabase,
    rows.map((row) => row.deal_id),
    dealScope,
  );

  return rows.filter((row) => allowedDealIds.has(row.deal_id));
}

export async function loadDealMilestoneCountsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dateColumn: DealMilestoneDateColumn,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  const rows = await loadDealsByMilestoneDateInPeriod(
    supabase,
    period,
    dateColumn,
    dealScope,
  );
  const { counts } = await mergeMilestoneRowsToCanonicalManager(rows);
  return counts;
}

export async function loadDealMilestoneAmountsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dateColumn: DealMilestoneDateColumn,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  const rows = await loadDealsByMilestoneDateInPeriod(
    supabase,
    period,
    dateColumn,
    dealScope,
  );
  const { amounts } = await mergeMilestoneRowsToCanonicalManager(rows);
  return amounts;
}

export async function loadDealMilestoneDealIdsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  dateColumn: DealMilestoneDateColumn,
  dealScope: DealScope = "primary",
  managerAliases?: ReadonlyArray<number>,
): Promise<number[]> {
  const rows = await loadDealsByMilestoneDateInPeriod(
    supabase,
    period,
    dateColumn,
    dealScope,
    managerAliases,
  );

  return [...new Set(rows.map((row) => row.deal_id))];
}
