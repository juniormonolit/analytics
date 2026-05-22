import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { loadEmployeeAliasLookupsForManagers } from "@/lib/org/repository";

import type { DealScope } from "@/features/reports/engine/dealScope";

import {
  canonicalManagerId,
  isPrimaryFunnel,
  isRepeatFunnel,
  loadRepeatFunnelIds,
  mergeDealSetsToCanonicalManager,
  periodEndExclusiveIso,
  periodStartIso,
} from "./primaryRepeatDeals";

export type PeriodDealEvent = {
  deal_id: number;
  manager_id: number;
  stage_id: string;
  amount_at_event: number | null;
  event_at: string;
};

export type DealState = {
  deal_id: number;
  current_manager_id: number;
  amount: number;
};

const DEAL_ID_IN_CHUNK_SIZE = 150;

function toFiniteAmount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function dealSetsByEventManager(
  events: ReadonlyArray<Pick<PeriodDealEvent, "deal_id" | "manager_id">>,
): Map<number, Set<number>> {
  const managerToDealIds = new Map<number, Set<number>>();

  for (const event of events) {
    const managerId = Number(event.manager_id);
    const dealId = Number(event.deal_id);
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

export function amountsByEventManager(
  events: ReadonlyArray<PeriodDealEvent>,
): Map<number, number> {
  const managerToAmount = new Map<number, number>();

  for (const event of events) {
    const managerId = Number(event.manager_id);
    if (!Number.isFinite(managerId)) continue;
    managerToAmount.set(
      managerId,
      (managerToAmount.get(managerId) ?? 0) + toFiniteAmount(event.amount_at_event),
    );
  }

  return managerToAmount;
}

/** First sold/shipped event per deal in period (by `event_at`). */
export function pickFirstSalesEventPerDeal(
  events: ReadonlyArray<PeriodDealEvent>,
): PeriodDealEvent[] {
  const byDeal = new Map<number, PeriodDealEvent>();

  for (const event of events) {
    const existing = byDeal.get(event.deal_id);
    if (!existing || event.event_at < existing.event_at) {
      byDeal.set(event.deal_id, event);
    }
  }

  return [...byDeal.values()];
}

export async function loadStageIdsByEventType(
  supabase: ServerSupabaseClient,
  eventType: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("stages")
    .select("id")
    .eq("event_type", eventType);

  if (error) {
    throw new Error(`stages lookup failed: ${error.message}`);
  }

  return new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id));
}

export async function loadStageIdsByEventTypes(
  supabase: ServerSupabaseClient,
  eventTypes: ReadonlyArray<string>,
): Promise<Set<string>> {
  if (eventTypes.length === 0) return new Set();

  const { data, error } = await supabase
    .from("stages")
    .select("id")
    .in("event_type", [...eventTypes]);

  if (error) {
    throw new Error(`stages lookup failed: ${error.message}`);
  }

  return new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id));
}

export async function loadStageIdsByStageType(
  supabase: ServerSupabaseClient,
  stageType: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("stages")
    .select("id")
    .eq("stage_type", stageType);

  if (error) {
    throw new Error(`stages lookup failed: ${error.message}`);
  }

  return new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id));
}

/** Отгрузки: `event_type = shipped`. */
export async function loadShipmentsStageIds(
  supabase: ServerSupabaseClient,
): Promise<Set<string>> {
  return loadStageIdsByEventType(supabase, "shipped");
}

export async function loadDealEventsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  stageIds: ReadonlySet<string>,
): Promise<PeriodDealEvent[]> {
  if (stageIds.size === 0) return [];

  const { data, error } = await supabase
    .from("deal_events")
    .select("deal_id, manager_id, stage_id, amount_at_event, event_at")
    .in("stage_id", [...stageIds])
    .gte("event_at", periodStartIso(period))
    .lt("event_at", periodEndExclusiveIso(period));

  if (error) {
    throw new Error(`deal_events lookup failed: ${error.message}`);
  }

  return (data ?? []) as PeriodDealEvent[];
}

/** Distinct deal ids with any qualifying event in the period (candidate set). */
export async function loadCandidateDealIdsWithEventsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  stageIds: ReadonlySet<string>,
): Promise<number[]> {
  const events = await loadDealEventsInPeriod(supabase, period, stageIds);
  return [...new Set(events.map((event) => event.deal_id))];
}

/** Full milestone history for deal ids (no date filter). */
export async function loadDealEventsForDealIds(
  supabase: ServerSupabaseClient,
  dealIds: ReadonlyArray<number>,
  stageIds: ReadonlySet<string>,
): Promise<PeriodDealEvent[]> {
  if (dealIds.length === 0 || stageIds.size === 0) return [];

  const stageIdList = [...stageIds];
  const rows: PeriodDealEvent[] = [];

  for (let offset = 0; offset < dealIds.length; offset += DEAL_ID_IN_CHUNK_SIZE) {
    const chunk = dealIds.slice(offset, offset + DEAL_ID_IN_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("deal_events")
      .select("deal_id, manager_id, stage_id, amount_at_event, event_at")
      .in("deal_id", chunk)
      .in("stage_id", stageIdList)
      .order("event_at", { ascending: true });

    if (error) {
      throw new Error(`deal_events lookup failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as PeriodDealEvent[]));
  }

  return rows;
}

export async function filterDealIdsByDealScope(
  supabase: ServerSupabaseClient,
  dealIds: ReadonlyArray<number>,
  dealScope: DealScope,
): Promise<Set<number>> {
  if (dealScope === "all" || dealIds.length === 0) {
    return new Set(dealIds);
  }

  const [funnelMap, repeatFunnelIds] = await Promise.all([
    loadDealFunnelMap(supabase, dealIds),
    loadRepeatFunnelIds(supabase),
  ]);

  const allowed = new Set<number>();
  for (const dealId of dealIds) {
    const funnelId = funnelMap.get(dealId);
    if (funnelId == null) continue;
    const matches =
      dealScope === "primary"
        ? isPrimaryFunnel(funnelId, repeatFunnelIds)
        : isRepeatFunnel(funnelId, repeatFunnelIds);
    if (matches) allowed.add(dealId);
  }

  return allowed;
}

export async function loadDealFunnelMap(
  supabase: ServerSupabaseClient,
  dealIds: ReadonlyArray<number>,
): Promise<Map<number, number>> {
  const funnelByDealId = new Map<number, number>();
  if (dealIds.length === 0) return funnelByDealId;

  for (let offset = 0; offset < dealIds.length; offset += DEAL_ID_IN_CHUNK_SIZE) {
    const chunk = dealIds.slice(offset, offset + DEAL_ID_IN_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("deals")
      .select("deal_id, funnel_id")
      .in("deal_id", chunk);

    if (error) {
      throw new Error(`deals lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<{ deal_id: number; funnel_id: number }>) {
      if (Number.isFinite(row.deal_id) && Number.isFinite(row.funnel_id)) {
        funnelByDealId.set(row.deal_id, row.funnel_id);
      }
    }
  }

  return funnelByDealId;
}

export async function loadDealStateMap(
  supabase: ServerSupabaseClient,
  dealIds: ReadonlyArray<number>,
): Promise<Map<number, DealState>> {
  const stateByDealId = new Map<number, DealState>();
  if (dealIds.length === 0) return stateByDealId;

  for (let offset = 0; offset < dealIds.length; offset += DEAL_ID_IN_CHUNK_SIZE) {
    const chunk = dealIds.slice(offset, offset + DEAL_ID_IN_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("deals")
      .select("deal_id, current_manager_id, amount")
      .in("deal_id", chunk);

    if (error) {
      throw new Error(`deals lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<{
      deal_id: number;
      current_manager_id: number;
      amount: number | null;
    }>) {
      if (!Number.isFinite(row.deal_id) || row.current_manager_id == null) continue;
      stateByDealId.set(row.deal_id, {
        deal_id: row.deal_id,
        current_manager_id: row.current_manager_id,
        amount: toFiniteAmount(row.amount),
      });
    }
  }

  return stateByDealId;
}

export function attributedMilestoneToPeriodDealEvent(
  milestoneEventAt: string,
  dealState: DealState,
): PeriodDealEvent {
  return {
    deal_id: dealState.deal_id,
    manager_id: dealState.current_manager_id,
    stage_id: "",
    amount_at_event: dealState.amount,
    event_at: milestoneEventAt,
  };
}

export async function filterEventsByDealScope(
  supabase: ServerSupabaseClient,
  events: ReadonlyArray<PeriodDealEvent>,
  dealScope: DealScope,
): Promise<PeriodDealEvent[]> {
  if (dealScope === "all" || events.length === 0) return [...events];

  const dealIds = [...new Set(events.map((event) => event.deal_id))];
  const [funnelMap, repeatFunnelIds] = await Promise.all([
    loadDealFunnelMap(supabase, dealIds),
    loadRepeatFunnelIds(supabase),
  ]);

  return events.filter((event) => {
    const funnelId = funnelMap.get(event.deal_id);
    if (funnelId == null) return false;
    return dealScope === "primary"
      ? isPrimaryFunnel(funnelId, repeatFunnelIds)
      : isRepeatFunnel(funnelId, repeatFunnelIds);
  });
}

function mergeAmountsToCanonicalManager(
  managerToAmount: ReadonlyMap<number, number>,
  byBitrixId: ReadonlyMap<number, { id: string; bitrix_id: number | null }>,
  byId: ReadonlyMap<string, { id: string; bitrix_id: number | null }>,
): Map<number, number> {
  const merged = new Map<number, number>();
  for (const [rawManagerId, amount] of managerToAmount) {
    const canonicalId = canonicalManagerId(rawManagerId, byBitrixId, byId);
    merged.set(canonicalId, (merged.get(canonicalId) ?? 0) + amount);
  }
  return merged;
}

async function mergeEventMetricsToCanonicalManager(
  events: ReadonlyArray<PeriodDealEvent>,
): Promise<{
  counts: Map<number, number>;
  amounts: Map<number, number>;
}> {
  const rawSets = dealSetsByEventManager(events);
  const rawAmounts = amountsByEventManager(events);

  const managerIds = Array.from(
    new Set([...rawSets.keys(), ...rawAmounts.keys()]),
  );

  if (managerIds.length === 0) {
    return { counts: new Map(), amounts: new Map() };
  }

  const { byBitrixId, byId } =
    await loadEmployeeAliasLookupsForManagers(managerIds);

  return {
    counts: mergeDealSetsToCanonicalManager(rawSets, byBitrixId, byId),
    amounts: mergeAmountsToCanonicalManager(rawAmounts, byBitrixId, byId),
  };
}

export async function loadEventDealCountsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  stageIds: ReadonlySet<string>,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  const events = await loadDealEventsInPeriod(supabase, period, stageIds);
  const scoped = await filterEventsByDealScope(supabase, events, dealScope);
  const { counts } = await mergeEventMetricsToCanonicalManager(scoped);
  return counts;
}

export async function loadEventDealAmountsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  stageIds: ReadonlySet<string>,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  const events = await loadDealEventsInPeriod(supabase, period, stageIds);
  const scoped = await filterEventsByDealScope(supabase, events, dealScope);
  const { amounts } = await mergeEventMetricsToCanonicalManager(scoped);
  return amounts;
}

export async function loadEventDealIdsInPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  stageIds: ReadonlySet<string>,
  dealScope: DealScope = "primary",
  managerAliases?: ReadonlyArray<number>,
): Promise<number[]> {
  let events = await loadDealEventsInPeriod(supabase, period, stageIds);
  events = await filterEventsByDealScope(supabase, events, dealScope);

  if (managerAliases && managerAliases.length > 0) {
    const allowed = new Set(managerAliases);
    events = events.filter((event) => allowed.has(event.manager_id));
  }

  return [...new Set(events.map((event) => event.deal_id))];
}
