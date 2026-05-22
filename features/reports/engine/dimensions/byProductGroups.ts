import "server-only";

/**
 * `by-product-groups` dimension fetcher.
 *
 * **v1 data-source decision (documented inline):** `sa.daily_sales`
 * does **not** carry a `product_group_id` column, so we cannot reuse
 * the daily-sales sums here. Instead we aggregate `sa.deals` directly
 * over `created_at` (`>= from` and `< to + 1 day` so `to` is
 * inclusive) and expose two synthetic metrics that don't need to live
 * in `sa.metrics`:
 *
 *   - `deals_count`  — count of rows (int).
 *   - `deals_amount` — sum of `amount` (money).
 *
 * If the catalog happens to ship rows with the same ids, we prefer
 * them so labels and color rules come from the database. The
 * user-supplied `metricIds` is intentionally ignored for this report
 * in v1: the column set is fixed by the data source.
 */
import { addDays, format, parseISO } from "date-fns";

import type { Period } from "@/lib/period/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

import type { MetricRow } from "../metricsCatalog";
import {
  DEFAULT_DEAL_SCOPE,
  type DealScope,
} from "../dealScope";
import {
  filterDealsByDealScope,
  loadRepeatFunnelIds,
} from "./primaryRepeatDeals";
import type {
  DimensionColumn,
  IntermediateRow,
  MetricColumn,
} from "../types";

type DealRow = Database["sa"]["Tables"]["deals"]["Row"];

const DIMENSION_COLUMNS: DimensionColumn[] = [
  { key: "product_group_name", label: "Товарная группа" },
];

const SYNTHETIC_METRICS: MetricRow[] = [
  {
    id: "deals_count",
    name_ru: "Кол-во сделок",
    name_short_ru: "Сделок",
    metric_type: "collected",
    data_type: "int",
    aggregation: null,
    source: "sa.deals",
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: "deals",
    sort_order: 0,
    is_core: true,
    is_active: true,
    created_at: null,
  },
  {
    id: "deals_amount",
    name_ru: "Сумма сделок",
    name_short_ru: "Сумма",
    metric_type: "collected",
    data_type: "money",
    aggregation: null,
    source: "sa.deals",
    source_column: "amount",
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: "deals",
    sort_order: 1,
    is_core: true,
    is_active: true,
    created_at: null,
  },
];

function metricRowToColumn(m: MetricRow): MetricColumn {
  return {
    id: m.id,
    label: m.name_ru,
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
 * Substitute synthetic metric definitions with their catalog
 * counterparts when available. Order is preserved.
 */
function selectMetrics(catalog: MetricRow[]): MetricRow[] {
  const byId = new Map(catalog.map((m) => [m.id, m] as const));
  return SYNTHETIC_METRICS.map((s) => byId.get(s.id) ?? s);
}

/**
 * The created_at column is `timestamptz`; we want a half-open interval
 * `[from, to+1)` so the `to` day is included regardless of timezone.
 * `addDays(parseISO(...), 1)` then `format("yyyy-MM-dd")` produces a
 * canonical ISO date that PostgREST safely casts to a timestamptz.
 */
function exclusiveEndDate(toIso: string): string {
  return format(addDays(parseISO(toIso), 1), "yyyy-MM-dd");
}

async function fetchByProductGroups(
  supabase: ServerSupabaseClient,
  period: Period,
  teamIds: number[] | undefined,
  // The metrics list is accepted for symmetry with `byManagers.fetch`
  // but ignored in v1 — see the file-level note above.
  _metrics: MetricRow[],
  dealScope: DealScope = DEFAULT_DEAL_SCOPE,
): Promise<IntermediateRow[]> {
  let dealsQuery = supabase
    .from("deals")
    .select("deal_id, product_group_id, amount, team_id, created_at, funnel_id")
    .gte("created_at", period.from)
    .lt("created_at", exclusiveEndDate(period.to));

  if (teamIds && teamIds.length > 0) {
    dealsQuery = dealsQuery.in("team_id", teamIds);
  }

  const { data, error } = await dealsQuery;
  if (error) {
    throw new Error(`deals query failed: ${error.message}`);
  }

  let rows = (data ?? []) as Array<
    Pick<
      DealRow,
      | "deal_id"
      | "product_group_id"
      | "amount"
      | "team_id"
      | "created_at"
      | "funnel_id"
    >
  >;

  if (dealScope !== "all") {
    const repeatFunnelIds = await loadRepeatFunnelIds(supabase);
    rows = filterDealsByDealScope(rows, repeatFunnelIds, dealScope);
  }

  // Bucket by product_group_id; null product_group is folded into a
  // single "Без товарной группы" bucket so it doesn't disappear.
  type Bucket = { groupId: number | null; count: number; sumAmount: number };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const key = r.product_group_id == null ? "unknown" : String(r.product_group_id);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { groupId: r.product_group_id ?? null, count: 0, sumAmount: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const amount =
      typeof r.amount === "number" ? r.amount : Number(r.amount ?? 0);
    if (Number.isFinite(amount)) {
      bucket.sumAmount += amount;
    }
  }

  // Resolve product group names.
  const knownGroupIds = Array.from(buckets.values())
    .map((b) => b.groupId)
    .filter((id): id is number => id != null);

  const namesById = new Map<number, string>();
  if (knownGroupIds.length > 0) {
    const { data: pgData, error: pgErr } = await supabase
      .from("product_groups")
      .select("id, name")
      .in("id", knownGroupIds);
    if (pgErr) {
      throw new Error(`product_groups lookup failed: ${pgErr.message}`);
    }
    // See note in `byManagers.ts`: re-assert the projection shape
    // because Supabase's inferred type narrows to `never` here.
    const pgRows = (pgData ?? []) as Array<{ id: number; name: string }>;
    for (const pg of pgRows) {
      namesById.set(pg.id, pg.name);
    }
  }

  const result: IntermediateRow[] = [];
  for (const [key, bucket] of buckets) {
    const groupName =
      bucket.groupId == null
        ? "Без товарной группы"
        : (namesById.get(bucket.groupId) ?? `Группа ${bucket.groupId}`);

    result.push({
      key,
      dimension: {
        product_group_id: bucket.groupId,
        product_group_name: groupName,
      },
      count: bucket.count,
      raw: {
        deals_count: bucket.count,
        deals_amount: bucket.sumAmount,
      },
    });
  }
  return result;
}

export const byProductGroups = {
  columns: DIMENSION_COLUMNS,
  expandMetricColumns,
  fetch: fetchByProductGroups,
  selectMetrics,
} as const;
