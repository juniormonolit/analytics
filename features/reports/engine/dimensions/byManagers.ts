import "server-only";

/**
 * `by-managers` dimension fetcher.
 *
 * Deal metrics are sourced from `sa.deals` and `sa.deal_events`:
 * - **Входящие** — `deals.created_at` in period
 * - **Обзвон** — `deal_events.event_at` in period
 * - **Брони / подтв. брони / продажи / отгрузки** — milestone-поля `deals`:
 *   `reserved_at`, `confirmed_at`, `sold_at`, `delivered_at`
 */
import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { MetricRow } from "../metricsCatalog";
import type {
  DimensionColumn,
  IntermediateRow,
  MetricColumn,
  RawAggregates,
} from "../types";
import { DEFAULT_DEAL_SCOPE, stripDealScopeSuffix, type DealScope } from "../dealScope";
import {
  CALLED_DEALS_METRIC_ID,
  isCalledDealsMetricId,
  loadCalledDealsByManager,
  needsCalledDealsFromDeals,
} from "./calledDeals";
import {
  isPrimaryDealsMetricId,
  isRepeatDealsMetricId,
  LEGACY_INCOMING_DEALS_METRIC_ID,
  loadScopedDealsByManager,
  needsFunnelBasedDealMetrics,
} from "./primaryRepeatDeals";
import {
  CONFIRMED_RESERVATIONS_METRIC_ID,
  isConfirmedReservationsMetricId,
  isReservationsMetricId,
  loadConfirmedReservationsByManager,
  loadReservationsByManager,
  needsConfirmedReservationsFromDealEvents,
  needsReservationsFromDealEvents,
  RESERVATIONS_METRIC_ID,
} from "./reservationDeals";
import {
  isSalesAmountMetricId,
  isSalesCountMetricId,
  isShipmentsAmountMetricId,
  isShipmentsCountMetricId,
  loadSalesShipmentsByManager,
  needsSalesShipmentsFromDeals,
} from "./salesShipmentsDeals";
import type { DepartmentId } from "@/lib/org/departmentId";
import type { ManagerEmployeeRow } from "@/lib/org/types";
import {
  buildManagerEmployeeLookups,
  loadDepartmentNamesByIds,
  loadManagerEmployeesByManagerIds,
} from "@/lib/org/repository";

const DIMENSION_COLUMNS: DimensionColumn[] = [
  { key: "manager_name", label: "Менеджер" },
  { key: "team_name", label: "Отдел" },
];

type EmployeeRow = ManagerEmployeeRow;

/** Legacy numeric team id from `deals`, or org department UUID. */
export function isValidTeamId(
  teamId: number | string | null | undefined,
): boolean {
  if (typeof teamId === "string") {
    return teamId.length > 0 && teamId !== "unknown";
  }
  return typeof teamId === "number" && teamId > 0;
}

export function resolveEmployeeForManagerId(
  managerId: number,
  byBitrixId: ReadonlyMap<number, EmployeeRow>,
  _byId: ReadonlyMap<string, EmployeeRow>,
): EmployeeRow | undefined {
  return byBitrixId.get(managerId);
}

export function resolveTeamIdForManager(
  sourceTeamId: number,
  employeeTeamId: DepartmentId | null | undefined,
): DepartmentId | number {
  if (employeeTeamId && isValidTeamId(employeeTeamId)) return employeeTeamId;
  if (isValidTeamId(sourceTeamId)) return sourceTeamId;
  return "unknown";
}

export function formatManagerLabel(
  managerId: number,
  employee: EmployeeRow | undefined,
): string {
  if (employee?.full_name) return employee.full_name;
  return `Менеджер #${managerId}`;
}

export function formatTeamLabel(
  teamId: DepartmentId | number,
  teamNameById: ReadonlyMap<string, string>,
): string {
  const key = String(teamId);
  const name = teamNameById.get(key);
  if (name) return name;
  if (typeof teamId === "number") return `Команда #${teamId}`;
  return "—";
}

function buildEmployeeLookups(rows: EmployeeRow[]): {
  byBitrixId: Map<number, EmployeeRow>;
  byId: Map<string, EmployeeRow>;
} {
  return buildManagerEmployeeLookups(rows);
}

function metricRowToColumn(m: MetricRow): MetricColumn {
  return {
    id: m.id,
    label: stripDealScopeSuffix(m.name_ru),
    dataType: (m.data_type as MetricColumn["dataType"]) ?? "decimal",
    decimalPlaces: m.decimal_places ?? 0,
    aggregationFn: (m.aggregation_fn ?? "sum") as MetricColumn["aggregationFn"],
    isCalculated: m.metric_type === "calculated",
    dependencies: m.dependencies ?? undefined,
    formula: m.formula ?? null,
    category: m.category ?? null,
  };
}

function expandMetricColumns(metrics: MetricRow[]): MetricColumn[] {
  return metrics.map(metricRowToColumn);
}

/**
 * Run the actual aggregation for one period. Always returns a fresh
 * array; callers run this twice (current + comparison) and merge
 * downstream.
 */
async function fetchByManagers(
  supabase: ServerSupabaseClient,
  period: Period,
  teamIds: DepartmentId[] | undefined,
  metrics: MetricRow[],
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<IntermediateRow[]> {
  const useCalledFromDeals = needsCalledDealsFromDeals(metrics);
  const useReservationsFromDealEvents =
    needsReservationsFromDealEvents(metrics);
  const useConfirmedReservationsFromDealEvents =
    needsConfirmedReservationsFromDealEvents(metrics);
  const useSalesShipmentsFromDeals = needsSalesShipmentsFromDeals(metrics);

  const [
    scopedDealsByManager,
    calledByManager,
    reservationsByManager,
    confirmedReservationsByManager,
    salesShipmentsByManager,
  ] = await Promise.all([
    needsFunnelBasedDealMetrics(metrics)
      ? loadScopedDealsByManager(supabase, period, dealScope)
      : Promise.resolve(new Map<number, number>()),
    useCalledFromDeals
      ? loadCalledDealsByManager(supabase, period, dealScope)
      : Promise.resolve(new Map<number, number>()),
    useReservationsFromDealEvents
      ? loadReservationsByManager(supabase, period, dealScope)
      : Promise.resolve(new Map<number, number>()),
    useConfirmedReservationsFromDealEvents
      ? loadConfirmedReservationsByManager(supabase, period, dealScope)
      : Promise.resolve(new Map<number, number>()),
    useSalesShipmentsFromDeals
      ? loadSalesShipmentsByManager(supabase, period, dealScope)
      : Promise.resolve({
          salesCount: new Map<number, number>(),
          salesAmount: new Map<number, number>(),
          shipmentsCount: new Map<number, number>(),
          shipmentsAmount: new Map<number, number>(),
        }),
  ]);

  type Bucket = {
    managerId: number;
    teamId: number;
  };
  const buckets = new Map<number, Bucket>();

  for (const managerId of new Set([
    ...scopedDealsByManager.keys(),
    ...calledByManager.keys(),
    ...reservationsByManager.keys(),
    ...confirmedReservationsByManager.keys(),
    ...salesShipmentsByManager.salesCount.keys(),
    ...salesShipmentsByManager.salesAmount.keys(),
    ...salesShipmentsByManager.shipmentsCount.keys(),
    ...salesShipmentsByManager.shipmentsAmount.keys(),
  ])) {
    if (!buckets.has(managerId)) {
      buckets.set(managerId, { managerId, teamId: 0 });
    }
  }

  if (buckets.size === 0) {
    return [];
  }

  const managerIds = Array.from(buckets.keys());

  const employeeRows = await loadManagerEmployeesByManagerIds(managerIds);
  const { byBitrixId, byId } = buildEmployeeLookups(employeeRows);

  const resolvedTeamIds = new Set<DepartmentId | number>();
  const resolvedTeamIdByManager = new Map<number, DepartmentId | number>();
  for (const bucket of buckets.values()) {
    const employee = resolveEmployeeForManagerId(
      bucket.managerId,
      byBitrixId,
      byId,
    );
    const resolvedTeamId = resolveTeamIdForManager(
      bucket.teamId,
      employee?.team_id,
    );
    resolvedTeamIdByManager.set(bucket.managerId, resolvedTeamId);
    resolvedTeamIds.add(resolvedTeamId);
  }

  const departmentNameKeys = Array.from(resolvedTeamIds)
    .filter((id): id is DepartmentId => typeof id === "string")
    .filter((id) => id !== "unknown");
  const teamNameById = await loadDepartmentNamesByIds(departmentNameKeys);

  const result: IntermediateRow[] = [];
  for (const bucket of buckets.values()) {
    const employee = resolveEmployeeForManagerId(
      bucket.managerId,
      byBitrixId,
      byId,
    );
    const resolvedTeamId =
      resolvedTeamIdByManager.get(bucket.managerId) ?? bucket.teamId;

    if (
      teamIds &&
      teamIds.length > 0 &&
      (typeof resolvedTeamId !== "string" ||
        !teamIds.includes(resolvedTeamId))
    ) {
      continue;
    }

    const raw: RawAggregates = {};
    for (const m of metrics) {
      if (
        needsFunnelBasedDealMetrics(metrics) &&
        (isPrimaryDealsMetricId(m.id) ||
          isRepeatDealsMetricId(m.id) ||
          (m.source_column != null &&
            (isPrimaryDealsMetricId(m.source_column) ||
              isRepeatDealsMetricId(m.source_column))))
      ) {
        raw[m.id] = scopedDealsByManager.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useCalledFromDeals &&
        (isCalledDealsMetricId(m.id) || m.source_column === CALLED_DEALS_METRIC_ID)
      ) {
        raw[m.id] = calledByManager.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useReservationsFromDealEvents &&
        (isReservationsMetricId(m.id) ||
          m.source_column === RESERVATIONS_METRIC_ID)
      ) {
        raw[m.id] = reservationsByManager.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useConfirmedReservationsFromDealEvents &&
        (isConfirmedReservationsMetricId(m.id) ||
          m.source_column === CONFIRMED_RESERVATIONS_METRIC_ID)
      ) {
        raw[m.id] =
          confirmedReservationsByManager.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useSalesShipmentsFromDeals &&
        (isSalesCountMetricId(m.id) ||
          (m.source_column != null && isSalesCountMetricId(m.source_column)))
      ) {
        raw[m.id] = salesShipmentsByManager.salesCount.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useSalesShipmentsFromDeals &&
        (isSalesAmountMetricId(m.id) ||
          (m.source_column != null && isSalesAmountMetricId(m.source_column)))
      ) {
        raw[m.id] =
          salesShipmentsByManager.salesAmount.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useSalesShipmentsFromDeals &&
        (isShipmentsCountMetricId(m.id) ||
          (m.source_column != null && isShipmentsCountMetricId(m.source_column)))
      ) {
        raw[m.id] =
          salesShipmentsByManager.shipmentsCount.get(bucket.managerId) ?? 0;
        continue;
      }
      if (
        useSalesShipmentsFromDeals &&
        (isShipmentsAmountMetricId(m.id) ||
          (m.source_column != null &&
            isShipmentsAmountMetricId(m.source_column)))
      ) {
        raw[m.id] =
          salesShipmentsByManager.shipmentsAmount.get(bucket.managerId) ?? 0;
        continue;
      }
      if (m.id === LEGACY_INCOMING_DEALS_METRIC_ID) {
        raw[m.id] = scopedDealsByManager.get(bucket.managerId) ?? 0;
      }
    }

    const managerName = formatManagerLabel(bucket.managerId, employee);
    const teamName = formatTeamLabel(resolvedTeamId, teamNameById);

    result.push({
      key: String(bucket.managerId),
      dimension: {
        manager_id: bucket.managerId,
        manager_name: managerName,
        team_id: resolvedTeamId,
        team_name: teamName,
      },
      count: 0,
      raw,
    });
  }
  return result;
}

export const byManagers = {
  columns: DIMENSION_COLUMNS,
  expandMetricColumns,
  fetch: fetchByManagers,
} as const;
