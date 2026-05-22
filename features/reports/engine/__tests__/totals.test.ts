/**
 * Tests for `features/reports/engine/totals.ts`.
 *
 * Critical contract from `ai_docs/04_METRICS.md`: ratio / CR metrics
 * are NEVER averaged across rows. The totals row recomputes them as
 * `sum(numerator) / sum(denominator)` so a small high-volume row
 * doesn't bias the result. The two MergedRows used here pin that:
 * averaging the per-row CRs (50% and 10%) would give 30%; the
 * correct ratio-of-sums is `(5+10) / (10+100) ≈ 13.64%`.
 */
import { describe, expect, it } from "vitest";

import type { MetricRow } from "../metricsCatalog";
import { aggregateMergedRows, computeTotalsRow } from "../totals";
import type { MergedRow } from "../types";

function metric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "m",
    name_ru: "M",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "decimal",
    aggregation: null,
    source: null,
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: null,
    sort_order: 0,
    is_core: false,
    is_active: true,
    created_at: null,
    ...overrides,
  };
}

function mergedRow(
  key: string,
  currentCount: number,
  previousCount: number,
  currentRaw: Record<string, number>,
  previousRaw: Record<string, number>,
  dimension: Record<string, string | number | null> = {},
): MergedRow {
  return {
    key,
    dimension,
    currentCount,
    previousCount,
    currentRaw,
    previousRaw,
  };
}

describe("aggregateMergedRows()", () => {
  it("sums counts and raw maps across a set of merged rows", () => {
    const rows: MergedRow[] = [
      mergedRow("1", 2, 1, { x: 10, y: 1 }, { x: 5 }),
      mergedRow("2", 3, 4, { x: 20, y: 4 }, { x: 5, y: 2 }),
    ];

    const agg = aggregateMergedRows(rows);
    expect(agg.currentCount).toBe(5);
    expect(agg.previousCount).toBe(5);
    expect(agg.currentRaw).toEqual({ x: 30, y: 5 });
    expect(agg.previousRaw).toEqual({ x: 10, y: 2 });
  });

  it("returns zero counts and empty maps for an empty input", () => {
    const agg = aggregateMergedRows([]);
    expect(agg).toEqual({
      currentCount: 0,
      previousCount: 0,
      currentRaw: {},
      previousRaw: {},
    });
  });
});

describe("computeTotalsRow()", () => {
  const sumDeals = metric({ id: "deals", aggregation_fn: "sum" });
  const sumAmount = metric({ id: "amount", aggregation_fn: "sum" });
  const cr = metric({
    id: "cr",
    metric_type: "calculated",
    data_type: "percent",
    dependencies: ["num", "den"],
  });

  it("uses key '__totals__' and an empty dimension map", () => {
    const row = computeTotalsRow([], [sumDeals]);
    expect(row.key).toBe("__totals__");
    expect(row.dimension).toEqual({});
  });

  it("sums sum-typed metrics across rows for current and previous", () => {
    const rows: MergedRow[] = [
      mergedRow("1", 1, 1, { deals: 10, amount: 100 }, { deals: 5, amount: 50 }),
      mergedRow("2", 1, 1, { deals: 20, amount: 200 }, { deals: 8, amount: 80 }),
    ];
    const totals = computeTotalsRow(rows, [sumDeals, sumAmount]);

    expect(totals.metrics.deals.current).toBe(30);
    expect(totals.metrics.deals.previous).toBe(13);
    expect(totals.metrics.deals.delta).toBe(17);

    expect(totals.metrics.amount.current).toBe(300);
    expect(totals.metrics.amount.previous).toBe(130);
  });

  it("recomputes ratio metrics from summed numerator/denominator (not the average of per-row ratios)", () => {
    // Per-row CRs: 5/10=50%, 10/100=10%. Mean would be 30%; the correct
    // totals CR is (5+10)/(10+100) ≈ 13.6363…%.
    const rows: MergedRow[] = [
      mergedRow("1", 1, 1, { num: 5, den: 10 }, { num: 2, den: 8 }),
      mergedRow("2", 1, 1, { num: 10, den: 100 }, { num: 4, den: 40 }),
    ];

    const totals = computeTotalsRow(rows, [cr]);
    expect(totals.metrics.cr.current).toBeCloseTo(15 / 110 * 100, 6);
    expect(totals.metrics.cr.current).not.toBeCloseTo(30, 1);

    expect(totals.metrics.cr.previous).toBeCloseTo(6 / 48 * 100, 6);
  });

  it("renders a null cell when the summed denominator for a ratio metric is zero", () => {
    const rows: MergedRow[] = [
      mergedRow("1", 1, 0, { num: 5, den: 0 }, {}),
    ];
    const totals = computeTotalsRow(rows, [cr]);
    expect(totals.metrics.cr.current).toBeNull();
    expect(totals.metrics.cr.previous).toBeNull();
    expect(totals.metrics.cr.delta).toBeNull();
    expect(totals.metrics.cr.deltaPercent).toBeNull();
  });

  it("emits zero (not null) for a sum metric when no rows have data for it", () => {
    // The totals raw map ends up `{}`. Per ai_docs/03_REPORT_ENGINE.md
    // a missing key is treated as 0 — sum totals across rows that
    // lack a metric contribute 0, not null.
    const rows: MergedRow[] = [
      mergedRow("1", 0, 0, {}, {}),
    ];
    const totals = computeTotalsRow(rows, [sumDeals]);
    expect(totals.metrics.deals.current).toBe(0);
    expect(totals.metrics.deals.previous).toBe(0);
    expect(totals.metrics.deals.delta).toBe(0);
    expect(totals.metrics.deals.deltaPercent).toBeNull();
  });

  it("sums sum metrics across rows where some lack the metric (missing → 0)", () => {
    // Row 1 has `deals` only on the current side; row 2 has it only
    // on the previous side. The totals must add the contributions
    // (treating absent values as 0) instead of nulling the cell.
    const rows: MergedRow[] = [
      mergedRow("1", 1, 1, { deals: 10 }, {}),
      mergedRow("2", 1, 1, {}, { deals: 4 }),
    ];
    const totals = computeTotalsRow(rows, [sumDeals]);
    expect(totals.metrics.deals.current).toBe(10);
    expect(totals.metrics.deals.previous).toBe(4);
    expect(totals.metrics.deals.delta).toBe(6);
    expect(totals.metrics.deals.deltaPercent).toBe(150);
  });
});
