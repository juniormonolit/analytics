import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { DealScope } from "@/features/reports/engine/dealScope";
import { metricsReferenceId } from "@/features/reports/engine/metricReferences";

import {
  loadDealMilestoneCountsByManager,
  loadDealMilestoneDealIdsInPeriod,
  type DealMilestoneDateColumn,
} from "./dealsMilestoneMetrics";
import {
  periodEndExclusiveIso,
  periodStartIso,
  resolveManagerIdAliases,
} from "./primaryRepeatDeals";

/** «Брони». */
export const RESERVATIONS_METRIC_ID = "reservations_count";

/** «Подтверждённые брони» / «Подтв. брони». */
export const CONFIRMED_RESERVATIONS_METRIC_ID = "confirmed_reservations_count";

export type HistoricalStageEventType = "called" | "reserved" | "confirmed";

export function isReservationsMetricId(id: string): boolean {
  return id === RESERVATIONS_METRIC_ID;
}

export function isConfirmedReservationsMetricId(id: string): boolean {
  return id === CONFIRMED_RESERVATIONS_METRIC_ID;
}

export function isHistoricalStageDealMetricId(id: string): boolean {
  return isReservationsMetricId(id) || isConfirmedReservationsMetricId(id);
}

export function milestoneDateColumnForMetric(
  metricId: string,
): DealMilestoneDateColumn | null {
  if (isReservationsMetricId(metricId)) return "reserved_at";
  if (isConfirmedReservationsMetricId(metricId)) return "confirmed_at";
  return null;
}

export function historicalEventTypeForMetric(
  metricId: string,
): HistoricalStageEventType | null {
  if (isReservationsMetricId(metricId)) return "reserved";
  if (isConfirmedReservationsMetricId(metricId)) return "confirmed";
  return null;
}

export function needsReservationsFromDealEvents(
  metrics: ReadonlyArray<{
    id: string;
    source_column?: string | null;
    dependencies?: string[] | null;
  }>,
): boolean {
  return metricsReferenceId(metrics, RESERVATIONS_METRIC_ID);
}

export function needsConfirmedReservationsFromDealEvents(
  metrics: ReadonlyArray<{
    id: string;
    source_column?: string | null;
    dependencies?: string[] | null;
  }>,
): boolean {
  return metricsReferenceId(metrics, CONFIRMED_RESERVATIONS_METRIC_ID);
}

export function needsHistoricalStageDealMetrics(
  metrics: ReadonlyArray<{ id: string; source_column?: string | null }>,
): boolean {
  return (
    needsReservationsFromDealEvents(metrics) ||
    needsConfirmedReservationsFromDealEvents(metrics)
  );
}

/** Distinct reservation deal counts per manager (`deals.reserved_at` in period). */
export async function loadReservationsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  return loadDealMilestoneCountsByManager(
    supabase,
    period,
    "reserved_at",
    dealScope,
  );
}

/** Distinct confirmed reservation deal counts per manager. */
export async function loadConfirmedReservationsByManager(
  supabase: ServerSupabaseClient,
  period: Period,
  dealScope: DealScope = "primary",
): Promise<Map<number, number>> {
  return loadDealMilestoneCountsByManager(
    supabase,
    period,
    "confirmed_at",
    dealScope,
  );
}

/** Deal ids for one manager in a period matching a milestone date in period. */
export async function loadManagerPeriodDealIdsForHistoricalStage(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  eventType: "reserved" | "confirmed",
  dealScope: DealScope = "primary",
): Promise<number[]> {
  const dateColumn = eventType === "reserved" ? "reserved_at" : "confirmed_at";
  const managerAliases = await resolveManagerIdAliases(supabase, managerId);
  return loadDealMilestoneDealIdsInPeriod(
    supabase,
    period,
    dateColumn,
    dealScope,
    managerAliases,
  );
}

/** @deprecated Period-scoped metrics no longer filter by `deals.created_at`. */
export async function loadDealsInPeriodForManagerAttribution(
  supabase: ServerSupabaseClient,
  period: Period,
): Promise<
  Array<{ deal_id: number; current_manager_id: number; funnel_id: number }>
> {
  const { data, error } = await supabase
    .from("deals")
    .select("deal_id, current_manager_id, funnel_id")
    .gte("created_at", periodStartIso(period))
    .lt("created_at", periodEndExclusiveIso(period));

  if (error) {
    throw new Error(`deals lookup failed: ${error.message}`);
  }

  return (data ?? []) as Array<{
    deal_id: number;
    current_manager_id: number;
    funnel_id: number;
  }>;
}
