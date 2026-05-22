import "server-only";

/**
 * In-memory cache of the active metrics catalog.
 *
 * The catalog (`sa.metrics`) is small, read-mostly and changes on the
 * order of "rare admin updates", so a per-process TTL cache is a much
 * better trade-off than refetching it on every report run. Bust it
 * explicitly via `clearMetricsCache()` from admin tools (or restart
 * the Node process) to pick up changes.
 */
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

import { isAlwaysHiddenFromReportUi } from "@/features/settings/metricUiVisibility";

export type MetricRow = Database["sa"]["Tables"]["metrics"]["Row"];

/** Core metrics shown in reports — excludes repeat duplicates and user-hidden ids. */
export function resolveCoreVisibleMetrics(
  catalog: ReadonlyArray<MetricRow>,
  uiHiddenMetricIds: readonly string[] = [],
): MetricRow[] {
  const hidden = new Set(uiHiddenMetricIds);
  return catalog.filter(
    (m) =>
      m.is_core === true &&
      !isAlwaysHiddenFromReportUi(m.id) &&
      !hidden.has(m.id),
  );
}

const TTL_MS = 5 * 60 * 1000;

const cache: { value: MetricRow[] | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
};

/**
 * Fetch the active metrics catalog (cached for 5 minutes per process).
 * Throws if Supabase returns an error.
 */
export async function loadActiveMetrics(
  supabase: ServerSupabaseClient,
): Promise<MetricRow[]> {
  if (cache.value && Date.now() < cache.expiresAt) {
    return cache.value;
  }

  const { data, error } = await supabase
    .from("metrics")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load metrics catalog: ${error.message}`);
  }

  // Keep technical metrics (e.g. called_deals_count) in the engine
  // catalog so calculated metrics can resolve dependencies.
  cache.value = data ?? [];
  cache.expiresAt = Date.now() + TTL_MS;
  return cache.value;
}

/** Clear the in-memory cache. Exposed for admin/test code. */
export function clearMetricsCache(): void {
  cache.value = null;
  cache.expiresAt = 0;
}

/**
 * Resolve user-supplied metric ids against the catalog.
 *
 * - If `input` includes the special token `"all_core"`, return every
 *   metric flagged `is_core = true` (catalog order is preserved).
 * - Otherwise return the catalog rows whose ids appear in `input`,
 *   preserving the **input** order so the UI can rely on it for
 *   column placement. Unknown ids are silently dropped — the caller
 *   already validated that the array is non-empty.
 */
export function resolveMetricIds(
  input: string[],
  catalog: MetricRow[],
  uiHiddenMetricIds: readonly string[] = [],
): MetricRow[] {
  if (input.includes("all_core")) {
    return resolveCoreVisibleMetrics(catalog, uiHiddenMetricIds);
  }
  const hidden = new Set(uiHiddenMetricIds);
  const byId = new Map(catalog.map((m) => [m.id, m] as const));
  const out: MetricRow[] = [];
  for (const id of input) {
    const m = byId.get(id);
    if (!m || hidden.has(m.id) || isAlwaysHiddenFromReportUi(m.id)) continue;
    out.push(m);
  }
  return out;
}
