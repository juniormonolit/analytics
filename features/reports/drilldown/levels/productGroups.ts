import "server-only";

/**
 * `by-managers` → `level=product-groups` drill-down.
 *
 * Given `rowKey.managerId`, returns one aggregate row per
 * `product_group_id` containing the synthetic deals_count /
 * deals_amount metrics for both the current and comparison periods,
 * merged using the same engine helpers (`mergeByDimension`,
 * `makeMetricCell`) so cell math is identical to a top-level report.
 *
 * Same period rules as the main report's `primary_deals_count`:
 *   - distinct primary deals (`funnel_id` not in repeat funnels) with
 *     `created_at` in the period;
 *   - manager attribution via `deals.current_manager_id` (Bitrix /
 *     internal id aliases resolved the same way as the main report);
 *   - department filter is not re-applied — the parent row was already
 *     team-filtered via `employees.team_id`.
 *
 * Joins `sa.product_groups.name` for the dimension label.
 */
import { makeMetricCell } from "@/features/reports/engine/aggregate";
import { mergeByDimension } from "@/features/reports/engine/comparison";
import type {
  DimensionColumn,
  IntermediateRow,
  MetricCell,
} from "@/features/reports/engine/types";
import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

import type { DrilldownAggregateResponse, DrilldownRequest } from "../types";
import type { DealScope } from "@/features/reports/engine/dealScope";
import { DEFAULT_DEAL_SCOPE } from "@/features/reports/engine/dealScope";
import { fetchDealsForManagerByMetric } from "./managerDeals";
import {
  SYNTHETIC_METRIC_COLUMNS,
  toFiniteAmount,
} from "./shared";

type DealRow = Database["sa"]["Tables"]["deals"]["Row"];

const DIMENSION_COLUMNS: DimensionColumn[] = [
  { key: "product_group_name", label: "Товарная группа" },
];

type DealProjection = Pick<
  DealRow,
  "deal_id" | "product_group_id" | "amount" | "team_id" | "created_at"
>;

/**
 * Aggregate one period's deals (already filtered by managerId + team)
 * into intermediate rows keyed by `product_group_id`.
 */
function aggregateByProductGroup(rows: DealProjection[]): IntermediateRow[] {
  const buckets = new Map<
    string,
    { groupId: number | null; count: number; sumAmount: number }
  >();

  for (const r of rows) {
    const key = r.product_group_id == null ? "unknown" : String(r.product_group_id);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { groupId: r.product_group_id ?? null, count: 0, sumAmount: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.sumAmount += toFiniteAmount(r.amount);
  }

  const out: IntermediateRow[] = [];
  for (const [key, bucket] of buckets) {
    out.push({
      key,
      dimension: {
        product_group_id: bucket.groupId,
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

/** Run the deals query for a single period, returning the projected rows. */
async function fetchDealsForPeriod(
  supabase: ServerSupabaseClient,
  period: Period,
  managerId: number,
  metricId?: string,
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<DealProjection[]> {
  return fetchDealsForManagerByMetric(
    supabase,
    period,
    managerId,
    "deal_id, product_group_id, amount, team_id, created_at",
    metricId,
    dealScope,
  );
}

/**
 * Resolve product-group ids → names. Missing rows fall back to a
 * synthesized `Группа N` so the table never shows an empty cell.
 */
async function resolveProductGroupNames(
  supabase: ServerSupabaseClient,
  ids: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("product_groups")
    .select("id, name")
    .in("id", ids);
  if (error) {
    throw new Error(`product_groups lookup failed: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ id: number; name: string }>;
  for (const r of rows) out.set(r.id, r.name);
  return out;
}

export async function runProductGroupsLevel(
  request: DrilldownRequest,
  supabase: ServerSupabaseClient,
): Promise<DrilldownAggregateResponse> {
  const managerId = request.rowKey.managerId;
  if (managerId === undefined) {
    throw new Error("rowKey.managerId is required for level=product-groups");
  }

  const dealScope = request.dealScope ?? DEFAULT_DEAL_SCOPE;

  const [currentDeals, previousDeals] = await Promise.all([
    fetchDealsForPeriod(
      supabase,
      request.period,
      managerId,
      request.metricId,
      dealScope,
    ),
    fetchDealsForPeriod(
      supabase,
      request.comparisonPeriod,
      managerId,
      request.metricId,
      dealScope,
    ),
  ]);

  const currentRows = aggregateByProductGroup(currentDeals);
  const previousRows = aggregateByProductGroup(previousDeals);

  const groupIds = new Set<number>();
  for (const row of [...currentRows, ...previousRows]) {
    const id = row.dimension.product_group_id;
    if (typeof id === "number") groupIds.add(id);
  }
  const namesById = await resolveProductGroupNames(
    supabase,
    Array.from(groupIds),
  );

  const merged = mergeByDimension(currentRows, previousRows);

  const aggregateRows = merged.map((row) => {
    const groupId = row.dimension.product_group_id;
    const groupName =
      typeof groupId === "number"
        ? (namesById.get(groupId) ?? `Группа ${groupId}`)
        : "Без товарной группы";

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
        product_group_id: groupId ?? null,
        product_group_name: groupName,
      },
      metrics,
    };
  });

  return {
    ok: true,
    level: "product-groups",
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
