import "server-only";

/**
 * `by-product-groups` → `level=managers` drill-down.
 *
 * Given `rowKey.productGroupId`, returns one aggregate row per
 * `current_manager_id` containing the synthetic deals_count /
 * deals_amount metrics for both the current and comparison periods,
 * merged using the same engine helpers (`mergeByDimension`,
 * `makeMetricCell`).
 *
 * Joins org `employees` / `org_resolved_hierarchy` for manager and
 * department labels.
 */
import { makeMetricCell } from "@/features/reports/engine/aggregate";
import { mergeByDimension } from "@/features/reports/engine/comparison";
import {
  resolveEmployeeForManagerId,
  resolveTeamIdForManager,
} from "@/features/reports/engine/dimensions/byManagers";
import type {
  DimensionColumn,
  IntermediateRow,
  MetricCell,
} from "@/features/reports/engine/types";
import type { Period } from "@/lib/period/types";
import type { DepartmentId } from "@/lib/org/departmentId";
import {
  buildManagerEmployeeLookups,
  loadDepartmentNamesByIds,
  loadManagerEmployeesByManagerIds,
} from "@/lib/org/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

import type { DrilldownAggregateResponse, DrilldownRequest } from "../types";
import type { DealScope } from "@/features/reports/engine/dealScope";
import { DEFAULT_DEAL_SCOPE } from "@/features/reports/engine/dealScope";
import { loadPeriodDealIdsForMetric } from "../dealMetricFilter";
import {
  SYNTHETIC_METRIC_COLUMNS,
  toFiniteAmount,
} from "./shared";

type DealRow = Database["sa"]["Tables"]["deals"]["Row"];

const DIMENSION_COLUMNS: DimensionColumn[] = [
  { key: "manager_name", label: "Менеджер" },
  { key: "team_name", label: "Отдел" },
];

type DealProjection = Pick<
  DealRow,
  "deal_id" | "current_manager_id" | "amount" | "team_id" | "created_at"
>;

function aggregateByManager(rows: DealProjection[]): IntermediateRow[] {
  const buckets = new Map<
    number,
    {
      managerId: number;
      teamId: number | null;
      count: number;
      sumAmount: number;
    }
  >();

  for (const r of rows) {
    let bucket = buckets.get(r.current_manager_id);
    if (!bucket) {
      bucket = {
        managerId: r.current_manager_id,
        teamId: r.team_id ?? null,
        count: 0,
        sumAmount: 0,
      };
      buckets.set(r.current_manager_id, bucket);
    } else if (r.team_id != null) {
      // Latest team wins — same convention as `byManagers` engine.
      bucket.teamId = r.team_id;
    }
    bucket.count += 1;
    bucket.sumAmount += toFiniteAmount(r.amount);
  }

  const out: IntermediateRow[] = [];
  for (const bucket of buckets.values()) {
    out.push({
      key: String(bucket.managerId),
      dimension: {
        manager_id: bucket.managerId,
        team_id: bucket.teamId,
      },
      count: bucket.count,
      raw: {
        deals_count: bucket.count,
        deals_amount: bucket.sumAmount,
      },
    });
  }
  return out;
}

async function fetchDealsForPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  productGroupId: number,
  metricId?: string,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<DealProjection[]> {
  const allowedDealIds = await loadPeriodDealIdsForMetric(
    supabase,
    period,
    metricId,
    undefined,
    dealScope,
  );
  if (allowedDealIds.length === 0) return [];

  const { data, error } = await supabase
    .from("deals")
    .select("deal_id, current_manager_id, amount, team_id, created_at")
    .eq("product_group_id", productGroupId)
    .in("deal_id", allowedDealIds);

  if (error) {
    throw new Error(`drilldown deals query failed: ${error.message}`);
  }
  return (data ?? []) as DealProjection[];
}

async function resolveLabels(
  managerIds: number[],
): Promise<{
  managerName: Map<number, string>;
  teamNameByDepartmentId: Map<DepartmentId, string>;
  managerTeamId: Map<number, DepartmentId | number | null>;
}> {
  const managerName = new Map<number, string>();
  const teamNameByDepartmentId = new Map<DepartmentId, string>();
  const managerTeamId = new Map<number, DepartmentId | number | null>();

  if (managerIds.length === 0) {
    return { managerName, teamNameByDepartmentId, managerTeamId };
  }

  const employeeRows = await loadManagerEmployeesByManagerIds(managerIds);
  const { byBitrixId, byId } = buildManagerEmployeeLookups(employeeRows);

  const departmentIds = new Set<DepartmentId>();
  for (const managerId of managerIds) {
    const employee = resolveEmployeeForManagerId(managerId, byBitrixId, byId);
    if (employee?.full_name) {
      managerName.set(managerId, employee.full_name);
    }
    const resolvedTeamId = resolveTeamIdForManager(0, employee?.team_id ?? null);
    managerTeamId.set(managerId, resolvedTeamId);
    if (typeof resolvedTeamId === "string" && resolvedTeamId !== "unknown") {
      departmentIds.add(resolvedTeamId);
    }
  }

  const names = await loadDepartmentNamesByIds([...departmentIds]);
  for (const [id, name] of names) {
    teamNameByDepartmentId.set(id, name);
  }

  return { managerName, teamNameByDepartmentId, managerTeamId };
}

export async function runManagersLevel(
  request: DrilldownRequest,
  supabase: ServerSupabaseClient,
): Promise<DrilldownAggregateResponse> {
  const productGroupId = request.rowKey.productGroupId;
  if (productGroupId === undefined) {
    throw new Error(
      "rowKey.productGroupId is required for level=managers",
    );
  }

  const teamIds = request.filters.teamIds;
  const dealScope = request.dealScope ?? DEFAULT_DEAL_SCOPE;

  const [currentDeals, previousDeals] = await Promise.all([
    fetchDealsForPeriod(
      supabase,
      request.period,
      productGroupId,
      request.metricId,
      dealScope,
    ),
    fetchDealsForPeriod(
      supabase,
      request.comparisonPeriod,
      productGroupId,
      request.metricId,
      dealScope,
    ),
  ]);

  const currentRows = aggregateByManager(currentDeals);
  const previousRows = aggregateByManager(previousDeals);

  const managerIdsSeen = new Set<number>();
  for (const row of [...currentRows, ...previousRows]) {
    const mid = row.dimension.manager_id;
    if (typeof mid === "number") managerIdsSeen.add(mid);
  }

  const labels = await resolveLabels(Array.from(managerIdsSeen));

  const merged = mergeByDimension(currentRows, previousRows);

  const aggregateRows = merged
    .map((row) => {
      const managerId = row.dimension.manager_id;
      const sourceTeamId = row.dimension.team_id;
      const resolvedTeamId =
        typeof managerId === "number"
          ? labels.managerTeamId.get(managerId) ??
            resolveTeamIdForManager(
              typeof sourceTeamId === "number" ? sourceTeamId : 0,
              null,
            )
          : 0;

      if (
        teamIds &&
        teamIds.length > 0 &&
        (typeof resolvedTeamId !== "string" ||
          !teamIds.includes(resolvedTeamId))
      ) {
        return null;
      }

      const teamId = resolvedTeamId;
      const managerName =
        typeof managerId === "number"
          ? (labels.managerName.get(managerId) ?? String(managerId))
          : "—";
      const teamName =
        typeof teamId === "string"
          ? (labels.teamNameByDepartmentId.get(teamId) ?? "—")
          : typeof teamId === "number"
            ? `Команда ${teamId}`
            : "—";

    const metrics: Record<string, MetricCell> = {};
    for (const m of SYNTHETIC_METRIC_COLUMNS) {
      metrics[m.id] = makeMetricCell(
        {
          id: m.id,
          name_ru: m.label,
          name_short_ru: null,
          metric_type: "collected",
          data_type: m.dataType,
          aggregation: null,
          source: null,
          source_column: null,
          formula: null,
          dependencies: null,
          decimal_places: m.decimalPlaces,
          color_rules: null,
          aggregation_fn: m.aggregationFn,
          category: m.category ?? null,
          sort_order: 0,
          is_core: true,
          is_active: true,
          created_at: null,
        },
        row.currentRaw,
        row.previousRaw,
        row.currentCount,
        row.previousCount,
      );
    }

    return {
      key: row.key,
      dimension: {
        manager_id: managerId ?? null,
        manager_name: managerName,
        team_id: teamId ?? null,
        team_name: teamName,
      },
      metrics,
    };
  })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    ok: true,
    level: "managers",
    columns: {
      dimension: DIMENSION_COLUMNS,
      metrics: SYNTHETIC_METRIC_COLUMNS,
    },
    rows: aggregateRows,
    meta: {
      period: request.period,
      comparisonPeriod: request.comparisonPeriod,
      rowKey: request.rowKey,
      reportSlug: request.reportSlug,
    },
  };
}
