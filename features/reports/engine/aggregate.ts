/**
 * Pure aggregation primitives — no Supabase deps.
 *
 * The engine's pipeline is deliberately split into "fetch + bucketize"
 * (in `dimensions/*`, which talks to Supabase) and "compute final
 * cells" (here), so all the math is unit-testable without mocking the
 * database client.
 *
 * The two crucial rules expressed here:
 *
 * 1. Ratio / CR metrics (those with `metric_type === "calculated"` and
 *    >= 2 dependencies) are recomputed as `numerator / denominator`
 *    from the row's accumulated `raw` map. We never average percents.
 *    A zero or missing denominator yields `null` (per `04_METRICS.md`).
 *
 * 2. Collected metrics treat a missing key in the raw bucket as `0`,
 *    not `null` — this matches the spec in `03_REPORT_ENGINE.md`:
 *
 *        current  = rowCurrent[metricId]  ?? 0
 *        previous = rowPrevious[metricId] ?? 0
 *
 *    so that a manager / product-group present in only one of the
 *    two periods still produces a meaningful delta. `aggregation_fn`
 *    determines how a present value is post-processed (`"avg"`
 *    divides by the source-row count; `"sum"` / `"none"` use the raw
 *    accumulated value directly).
 */
import type { MetricRow } from "./metricsCatalog";
import type { IntermediateRow, MetricCell, RawAggregates } from "./types";

/**
 * Compute a single metric value (current OR previous) from a raw
 * aggregate bucket.
 *
 * - Calculated / ratio metrics return `null` when the numerator or
 *   denominator is missing, or when the denominator is 0 (CR rule
 *   from `ai_docs/04_METRICS.md`).
 * - Collected metrics return `0` for a missing key (spec in
 *   `ai_docs/03_REPORT_ENGINE.md`). For `aggregation_fn === "avg"`
 *   the accumulated value is divided by the bucket's source-row
 *   `count`; with `count === 0` we fall back to `0` (no rows means
 *   no signal — same as a missing key).
 */
export function computeMetricValue(
  metric: MetricRow,
  raw: RawAggregates,
  count: number,
): number | null {
  if (metric.metric_type === "calculated") {
    const deps = metric.dependencies ?? [];
    if (deps.length < 2) return null;

    const [numId, denId] = deps;
    const num = raw[numId];
    const den = raw[denId];
    if (typeof num !== "number" || typeof den !== "number") return null;
    if (den === 0) return null;

    const ratio = num / den;
    return metric.data_type === "percent" ? ratio * 100 : ratio;
  }

  // metric_type ∈ { "collected", "external" }
  const fn = metric.aggregation_fn ?? "sum";
  const value = raw[metric.id];

  if (fn === "avg") {
    if (typeof value !== "number") return 0;
    return count > 0 ? value / count : 0;
  }

  // fn === "sum" | "none": return the accumulated raw value, or 0
  // when this metric never showed up in the bucket.
  return typeof value === "number" ? value : 0;
}

/**
 * Build a `MetricCell` (current/previous/delta/deltaPercent) from
 * raw aggregate buckets for both periods. `delta` is `null` when
 * either side is `null`; `deltaPercent` is also `null` when the
 * previous value is 0 — the UI renders that as `—`.
 */
export function makeMetricCell(
  metric: MetricRow,
  currentRaw: RawAggregates,
  previousRaw: RawAggregates,
  currentCount: number,
  previousCount: number,
): MetricCell {
  const current = computeMetricValue(metric, currentRaw, currentCount);
  const previous = computeMetricValue(metric, previousRaw, previousCount);

  const delta =
    current === null || previous === null ? null : current - previous;

  const deltaPercent =
    previous === null || previous === 0 || delta === null
      ? null
      : (delta / previous) * 100;

  return { current, previous, delta, deltaPercent };
}

/** Element-wise sum of two raw aggregate maps. Pure; new object. */
export function sumRaw(a: RawAggregates, b: RawAggregates): RawAggregates {
  const out: RawAggregates = { ...a };
  for (const key of Object.keys(b)) {
    out[key] = (out[key] ?? 0) + b[key];
  }
  return out;
}

/**
 * Generic bucketizer used by dimension fetchers.
 *
 * @param rows         Source rows (e.g. daily_sales rows).
 * @param keyFn        Extract the dimension key string for a row.
 * @param dimensionFn  Build the `dimension` label map for a row;
 *                     called once per *new* bucket.
 * @param reducer      Accumulate per-metric raw values into the bucket.
 */
export function aggregateBy<R>(
  rows: R[],
  keyFn: (row: R) => string,
  dimensionFn: (row: R) => Record<string, string | number | null>,
  reducer: (acc: RawAggregates, row: R) => void,
): IntermediateRow[] {
  const map = new Map<string, IntermediateRow>();
  for (const row of rows) {
    const key = keyFn(row);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        dimension: dimensionFn(row),
        count: 0,
        raw: {},
      };
      map.set(key, bucket);
    }
    bucket.count += 1;
    reducer(bucket.raw, row);
  }
  return Array.from(map.values());
}

/**
 * Convenience: build the `metrics` field for a Row given a merged
 * raw bucket and the visible metric set. Lives here because it's
 * a thin wrapper over `makeMetricCell` and used by both the per-row
 * and the totals/group code paths.
 */
export function buildMetricCells(
  metrics: MetricRow[],
  currentRaw: RawAggregates,
  previousRaw: RawAggregates,
  currentCount: number,
  previousCount: number,
): Record<string, MetricCell> {
  const cells: Record<string, MetricCell> = {};
  for (const m of metrics) {
    cells[m.id] = makeMetricCell(
      m,
      currentRaw,
      previousRaw,
      currentCount,
      previousCount,
    );
  }
  return cells;
}
