import "server-only";

/**
 * Top-level orchestrator for `POST /api/reports/run`.
 *
 * Wires together the catalog cache, the dimension-specific fetcher,
 * the merge-by-key step, the grouping pass, and the totals pass —
 * keeping the route handler itself trivial (validate body → call this
 * → respond). Each phase lives in its own file and is unit-testable
 * in isolation.
 */
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { mergeByDimension } from "./comparison";
import { byManagers } from "./dimensions/byManagers";
import { byProductGroups } from "./dimensions/byProductGroups";
import { applyGrouping } from "./grouping";
import {
  loadActiveMetrics,
  resolveCoreVisibleMetrics,
  resolveMetricIds,
  type MetricRow,
} from "./metricsCatalog";
import { computeTotalsRow } from "./totals";
import type { RunReportRequest, RunReportResponse } from "./types";
import { DEFAULT_DEAL_SCOPE } from "./dealScope";
import {
  resolveBitrixDepartmentIds,
  resolveExpandedDepartmentFilterIds,
} from "@/lib/org/repository";

/**
 * Expand a metric set with all transitive dependency metrics from
 * the catalog. The bucketizer in each dimension fetcher needs every
 * dependency metric (numerator / denominator) to also be present so
 * its `source_column` gets summed alongside the requested metrics.
 */
function withDependencyMetrics(
  selected: MetricRow[],
  catalog: MetricRow[],
): MetricRow[] {
  const byId = new Map(catalog.map((m) => [m.id, m] as const));
  const seen = new Map<string, MetricRow>();
  const queue: MetricRow[] = [...selected];

  while (queue.length > 0) {
    const m = queue.shift();
    if (!m || seen.has(m.id)) continue;
    seen.set(m.id, m);
    for (const depId of m.dependencies ?? []) {
      if (seen.has(depId)) continue;
      const dep = byId.get(depId);
      if (dep) queue.push(dep);
    }
  }
  return Array.from(seen.values());
}

export async function runReport(
  input: RunReportRequest,
  supabase: ServerSupabaseClient,
): Promise<RunReportResponse> {
  const catalog = await loadActiveMetrics(supabase);
  const uiHiddenMetricIds = input.uiHiddenMetricIds ?? [];

  // Pick the dimension and the visible metric set. `by-product-groups`
  // currently exposes a fixed pair of synthetic metrics — see the
  // comment in `dimensions/byProductGroups.ts`.
  let visibleMetrics: MetricRow[];
  if (input.reportSlug === "by-managers") {
    visibleMetrics = resolveMetricIds(
      input.metricIds,
      catalog,
      uiHiddenMetricIds,
    );
    if (visibleMetrics.length === 0) {
      // Fall back to all core metrics so the response is never empty
      // when the caller supplies unknown ids — same default as the
      // `"all_core"` token.
      visibleMetrics = resolveCoreVisibleMetrics(catalog, uiHiddenMetricIds);
    }
  } else {
    visibleMetrics = byProductGroups.selectMetrics(catalog);
  }

  // The fetcher needs every dependency metric to also have its
  // source column summed; otherwise calculated metrics can't recompute
  // their numerator / denominator at totals time.
  const fetchMetrics = withDependencyMetrics(visibleMetrics, catalog);

  const selectedDepartmentIds = input.filters.teamIds ?? [];
  const departmentIds =
    selectedDepartmentIds.length > 0
      ? await resolveExpandedDepartmentFilterIds(selectedDepartmentIds)
      : [];
  const dealScope = input.dealScope ?? DEFAULT_DEAL_SCOPE;

  let current;
  let previous;
  if (input.reportSlug === "by-managers") {
    [current, previous] = await Promise.all([
      byManagers.fetch(
        supabase,
        input.period,
        departmentIds,
        fetchMetrics,
        dealScope,
      ),
      byManagers.fetch(
        supabase,
        input.comparisonPeriod,
        departmentIds,
        fetchMetrics,
        dealScope,
      ),
    ]);
  } else {
    const bitrixDepartmentIds =
      departmentIds.length > 0
        ? await resolveBitrixDepartmentIds(departmentIds)
        : [];
    [current, previous] = await Promise.all([
      byProductGroups.fetch(
        supabase,
        input.period,
        bitrixDepartmentIds,
        fetchMetrics,
        dealScope,
      ),
      byProductGroups.fetch(
        supabase,
        input.comparisonPeriod,
        bitrixDepartmentIds,
        fetchMetrics,
        dealScope,
      ),
    ]);
  }

  const merged = mergeByDimension(current, previous);
  const grouped = applyGrouping(merged, input.grouping, visibleMetrics);

  // When the caller asked for `total` grouping, `grouped.rows` already
  // contains exactly the totals row, so emitting an additional totals
  // field would be redundant — and the contract says `null` here.
  const totals =
    input.grouping === "total"
      ? null
      : computeTotalsRow(merged, visibleMetrics);

  const dimension =
    input.reportSlug === "by-managers" ? byManagers : byProductGroups;

  return {
    columns: {
      dimension: dimension.columns,
      metrics: dimension.expandMetricColumns(visibleMetrics),
    },
    rows: grouped.rows,
    totals,
    meta: {
      period: input.period,
      comparisonPeriod: input.comparisonPeriod,
    },
  };
}
