import "server-only";

/**
 * `level=deals` drill-down.
 *
 * Returns one row per deal matching the request filters, with the
 * fields specified in `ai_docs/03_REPORT_ENGINE.md` plus the joined
 * `stage_name` (from `sa.stages`) and `product_group_name` (from
 * `sa.product_groups`).
 *
 * Filters applied:
 *   - when `managerId` is present: deals in period attributed via
 *     `deals.current_manager_id`, filtered by `metricId` (funnel split or
 *     stage `event_type` — same rules as the main report);
 *   - otherwise: `created_at` in `[from, to + 1)` with optional
 *     `team_id IN (...)` from section filters;
 *   - `product_group_id = productGroupId` when present in `rowKey`.
 *
 * Pagination: `limit` (default 100) + `offset` (default 0). Returns
 * the full match `total` so the UI can render «Показано N из M».
 *
 * Order: `created_at DESC` to surface the most recent deals first.
 */
import type { DepartmentId } from "@/lib/org/departmentId";
import { resolveBitrixDepartmentIds } from "@/lib/org/repository";
import type { Database } from "@/lib/supabase/types.generated";

import { resolveManagerIdAliases } from "@/features/reports/engine/dimensions/primaryRepeatDeals";

import type {
  DealRow as DrilldownDealRow,
  DrilldownDealsResponse,
  DrilldownRequest,
} from "../types";
import type { DealScope } from "@/features/reports/engine/dealScope";
import { DEFAULT_DEAL_SCOPE } from "@/features/reports/engine/dealScope";
import { loadManagerPeriodDealIds } from "./managerDeals";
import { loadPeriodDealIdsForMetric } from "../dealMetricFilter";
import { exclusiveEndDate, toFiniteAmount } from "./shared";

type SaDealRow = Database["sa"]["Tables"]["deals"]["Row"];

const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 1000;

type DealProjection = Pick<
  SaDealRow,
  | "deal_id"
  | "deal_name"
  | "amount"
  | "created_at"
  | "stage_id"
  | "current_manager_id"
  | "team_id"
  | "product_group_id"
>;

/**
 * Apply the row-key + period + team filters to a Supabase query
 * builder. The `deals` table is queried with `count: "exact"` so we
 * can return the total in the response without a second round-trip.
 */
async function buildDealsQuery(
  supabase: ServerSupabaseClient,
  period: Period,
  rowKey: DrilldownRequest["rowKey"],
  departmentIds: DepartmentId[] | undefined,
  metricId: string | undefined,
  dealScope: DealScope,
  range: { offset: number; limit: number },
) {
  const bitrixTeamIds =
    departmentIds && departmentIds.length > 0
      ? await resolveBitrixDepartmentIds(departmentIds)
      : undefined;

  const managerScoped = rowKey.managerId !== undefined;
  const managerDealIds = managerScoped
    ? await loadManagerPeriodDealIds(
        supabase,
        period,
        rowKey.managerId!,
        metricId,
        dealScope,
      )
    : [];

  let query = supabase
    .from("deals")
    .select(
      "deal_id, deal_name, amount, created_at, stage_id, current_manager_id, team_id, product_group_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(range.offset, range.offset + range.limit - 1);

  if (managerScoped) {
    if (managerDealIds.length > 0) {
      const managerAliases = await resolveManagerIdAliases(
        supabase,
        rowKey.managerId!,
      );
      query = query
        .in("deal_id", managerDealIds)
        .in("current_manager_id", managerAliases);
    } else {
      query = query.in("deal_id", [-1]);
    }
  } else if (metricId) {
    const allowedDealIds = await loadPeriodDealIdsForMetric(
      supabase,
      period,
      metricId,
      undefined,
      dealScope,
    );
    query =
      allowedDealIds.length > 0
        ? query.in("deal_id", allowedDealIds)
        : query.in("deal_id", [-1]);
  } else {
    query = query
      .gte("created_at", period.from)
      .lt("created_at", exclusiveEndDate(period.to));
    if (bitrixTeamIds && bitrixTeamIds.length > 0) {
      query = query.in("team_id", bitrixTeamIds);
    }
  }

  if (rowKey.productGroupId !== undefined) {
    query = query.eq("product_group_id", rowKey.productGroupId);
  }
  return query;
}

/** Resolve `stage_id` → `name` for the rows we're about to return. */
async function resolveStageNames(
  supabase: ServerSupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("stages")
    .select("id, name")
    .in("id", ids);
  if (error) {
    throw new Error(`stages lookup failed: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  for (const r of rows) out.set(r.id, r.name);
  return out;
}

/** Resolve `product_group_id` → `name`. */
async function resolveGroupNames(
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

export async function runDealsLevel(
  request: DrilldownRequest,
  supabase: ServerSupabaseClient,
): Promise<DrilldownDealsResponse> {
  const limit = Math.min(request.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = request.offset ?? DEFAULT_OFFSET;

  const dealScope = request.dealScope ?? DEFAULT_DEAL_SCOPE;

  const { data, error, count } = await buildDealsQuery(
    supabase,
    request.period,
    request.rowKey,
    request.filters.teamIds,
    request.metricId,
    dealScope,
    { offset, limit },
  );

  if (error) {
    throw new Error(`deals listing failed: ${error.message}`);
  }

  const rows = (data ?? []) as DealProjection[];

  const stageIds = Array.from(new Set(rows.map((r) => r.stage_id)));
  const groupIds = Array.from(
    new Set(
      rows
        .map((r) => r.product_group_id)
        .filter((id): id is number => id != null),
    ),
  );

  const [stageNames, groupNames] = await Promise.all([
    resolveStageNames(supabase, stageIds),
    resolveGroupNames(supabase, groupIds),
  ]);

  const dealRows: DrilldownDealRow[] = rows.map((r) => ({
    dealId: r.deal_id,
    dealName: r.deal_name ?? null,
    amount: toFiniteAmount(r.amount),
    createdAt: r.created_at,
    stageId: r.stage_id,
    stageName: stageNames.get(r.stage_id) ?? null,
    managerId: r.current_manager_id,
    teamId: r.team_id ?? null,
    productGroupId: r.product_group_id ?? null,
    productGroupName:
      r.product_group_id == null
        ? null
        : (groupNames.get(r.product_group_id) ?? null),
  }));

  return {
    ok: true,
    level: "deals",
    rows: dealRows,
    total: count ?? dealRows.length,
    limit,
    offset,
    meta: {
      period: request.period,
      comparisonPeriod: request.comparisonPeriod,
      rowKey: request.rowKey,
      reportSlug: request.reportSlug,
    },
  };
}
