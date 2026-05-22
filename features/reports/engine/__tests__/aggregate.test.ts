/**
 * Tests for `features/reports/engine/aggregate.ts`.
 *
 * Pure helpers — no Supabase, no orchestrator. Verifies:
 *   - `computeMetricValue` for collected (sum / avg / none) and
 *     calculated (ratio with %-vs-decimal output, dependency missing,
 *     denominator zero) metrics.
 *   - `makeMetricCell` delta / deltaPercent edge cases that the
 *     report engine spec calls out (previous=0 → null deltaPercent;
 *     both zero; nominal growth).
 *   - `sumRaw` element-wise addition with non-overlapping keys.
 *   - `aggregateBy` bucket counts and per-bucket reducer accumulation.
 *   - `buildMetricCells` produces a record keyed by metric id.
 */
import { describe, expect, it } from "vitest";

import {
  aggregateBy,
  buildMetricCells,
  computeMetricValue,
  makeMetricCell,
  sumRaw,
} from "../aggregate";
import type { MetricRow } from "../metricsCatalog";
import type { RawAggregates } from "../types";

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

describe("computeMetricValue()", () => {
  it("returns the raw sum for a collected sum metric", () => {
    const m = metric({ id: "deals", aggregation_fn: "sum" });
    expect(computeMetricValue(m, { deals: 42 }, 7)).toBe(42);
  });

  it("returns sum/count for a collected avg metric", () => {
    const m = metric({ id: "x", aggregation_fn: "avg" });
    expect(computeMetricValue(m, { x: 100 }, 5)).toBe(20);
  });

  it("returns the raw value for a collected metric with aggregation_fn = 'none'", () => {
    // `"none"` doesn't post-process the accumulator — it just hands
    // back whatever the bucketizer summed under this metric's id.
    const m = metric({ id: "x", aggregation_fn: "none" });
    expect(computeMetricValue(m, { x: 100 }, 5)).toBe(100);
  });

  it("returns 0 for a collected avg metric with count = 0", () => {
    // No source rows in the bucket → no signal, treat as 0 (same
    // semantics as a missing key per the spec).
    const m = metric({ id: "x", aggregation_fn: "avg" });
    expect(computeMetricValue(m, { x: 100 }, 0)).toBe(0);
  });

  it("returns 0 when the raw bucket lacks a sum metric's id entry (spec: rowCurrent[id] ?? 0)", () => {
    // Spec — ai_docs/03_REPORT_ENGINE.md:
    //   current  = rowCurrent[metricId]  ?? 0
    //   previous = rowPrevious[metricId] ?? 0
    // A dimension key that exists in only one period must still
    // produce a numeric value on the absent side so the delta is
    // computable.
    const m = metric({ id: "x", aggregation_fn: "sum" });
    expect(computeMetricValue(m, {}, 1)).toBe(0);
  });

  it("returns 0 when the raw bucket lacks an avg metric's id entry", () => {
    const m = metric({ id: "x", aggregation_fn: "avg" });
    expect(computeMetricValue(m, {}, 4)).toBe(0);
  });

  it("returns null for a calculated metric without dependencies", () => {
    const m = metric({ metric_type: "calculated", dependencies: null });
    expect(computeMetricValue(m, {}, 0)).toBeNull();
  });

  it("returns null for a calculated metric with fewer than 2 dependencies", () => {
    const m = metric({ metric_type: "calculated", dependencies: ["only_one"] });
    expect(computeMetricValue(m, { only_one: 5 }, 0)).toBeNull();
  });

  it("computes ratio as numerator/denominator for a calculated decimal metric", () => {
    const m = metric({
      id: "ratio",
      metric_type: "calculated",
      data_type: "decimal",
      dependencies: ["num", "den"],
    });
    expect(computeMetricValue(m, { num: 25, den: 100 }, 0)).toBe(0.25);
  });

  it("scales ratio to a percentage for a calculated percent metric", () => {
    const m = metric({
      id: "cr",
      metric_type: "calculated",
      data_type: "percent",
      dependencies: ["num", "den"],
    });
    expect(computeMetricValue(m, { num: 25, den: 100 }, 0)).toBe(25);
  });

  it("returns null when the denominator is zero (ratio metric)", () => {
    const m = metric({
      metric_type: "calculated",
      data_type: "percent",
      dependencies: ["num", "den"],
    });
    expect(computeMetricValue(m, { num: 5, den: 0 }, 0)).toBeNull();
  });

  it("returns null when either dependency value is missing", () => {
    const m = metric({
      metric_type: "calculated",
      data_type: "percent",
      dependencies: ["num", "den"],
    });
    expect(computeMetricValue(m, { num: 5 }, 0)).toBeNull();
    expect(computeMetricValue(m, { den: 5 }, 0)).toBeNull();
  });
});

describe("makeMetricCell()", () => {
  const sumMetric = metric({ id: "x", aggregation_fn: "sum" });

  it("previous=0, current=10 → delta=10, deltaPercent=null", () => {
    const cell = makeMetricCell(sumMetric, { x: 10 }, { x: 0 }, 1, 1);
    expect(cell.current).toBe(10);
    expect(cell.previous).toBe(0);
    expect(cell.delta).toBe(10);
    expect(cell.deltaPercent).toBeNull();
  });

  it("previous=100, current=120 → delta=20, deltaPercent=20", () => {
    const cell = makeMetricCell(sumMetric, { x: 120 }, { x: 100 }, 1, 1);
    expect(cell.current).toBe(120);
    expect(cell.previous).toBe(100);
    expect(cell.delta).toBe(20);
    expect(cell.deltaPercent).toBe(20);
  });

  it("both zero → delta=0, deltaPercent=null", () => {
    const cell = makeMetricCell(sumMetric, { x: 0 }, { x: 0 }, 1, 1);
    expect(cell.current).toBe(0);
    expect(cell.previous).toBe(0);
    expect(cell.delta).toBe(0);
    expect(cell.deltaPercent).toBeNull();
  });

  it("delta is null when either side cannot be computed", () => {
    const m = metric({
      metric_type: "calculated",
      data_type: "percent",
      dependencies: ["num", "den"],
    });
    const cell = makeMetricCell(m, { num: 1, den: 4 }, { num: 1, den: 0 }, 0, 0);
    expect(cell.current).toBe(25);
    expect(cell.previous).toBeNull();
    expect(cell.delta).toBeNull();
    expect(cell.deltaPercent).toBeNull();
  });

  it("deltaPercent is negative for a regression", () => {
    const cell = makeMetricCell(sumMetric, { x: 80 }, { x: 100 }, 1, 1);
    expect(cell.delta).toBe(-20);
    expect(cell.deltaPercent).toBe(-20);
  });
});

describe("sumRaw()", () => {
  it("element-wise sums two maps and returns a fresh object", () => {
    const a: RawAggregates = { x: 1, y: 2 };
    const b: RawAggregates = { y: 3, z: 4 };
    const out = sumRaw(a, b);
    expect(out).toEqual({ x: 1, y: 5, z: 4 });
    // Inputs are untouched.
    expect(a).toEqual({ x: 1, y: 2 });
    expect(b).toEqual({ y: 3, z: 4 });
    // New object identity.
    expect(out).not.toBe(a);
  });

  it("treats a missing key in `a` as zero", () => {
    expect(sumRaw({}, { z: 5 })).toEqual({ z: 5 });
  });
});

describe("aggregateBy()", () => {
  type Row = { mgr: number; team: string; deals: number };
  const rows: Row[] = [
    { mgr: 1, team: "Alpha", deals: 3 },
    { mgr: 1, team: "Alpha", deals: 4 },
    { mgr: 2, team: "Beta", deals: 5 },
  ];

  it("groups by the keyFn and accumulates raw values via the reducer", () => {
    const out = aggregateBy(
      rows,
      (r) => String(r.mgr),
      (r) => ({ team_name: r.team }),
      (acc, r) => {
        acc.deals = (acc.deals ?? 0) + r.deals;
      },
    );

    expect(out).toHaveLength(2);

    const mgr1 = out.find((b) => b.key === "1")!;
    expect(mgr1.dimension).toEqual({ team_name: "Alpha" });
    expect(mgr1.count).toBe(2);
    expect(mgr1.raw).toEqual({ deals: 7 });

    const mgr2 = out.find((b) => b.key === "2")!;
    expect(mgr2.count).toBe(1);
    expect(mgr2.raw).toEqual({ deals: 5 });
  });

  it("returns an empty array for an empty input", () => {
    const out = aggregateBy<Row>(
      [],
      (r) => String(r.mgr),
      () => ({}),
      () => {},
    );
    expect(out).toEqual([]);
  });

  it("calls dimensionFn only once per new bucket", () => {
    let dimensionCalls = 0;
    aggregateBy(
      rows,
      (r) => String(r.mgr),
      (r) => {
        dimensionCalls += 1;
        return { team_name: r.team };
      },
      () => {},
    );
    expect(dimensionCalls).toBe(2);
  });
});

describe("buildMetricCells()", () => {
  it("returns a record keyed by metric id, one cell per metric", () => {
    const sum = metric({ id: "deals", aggregation_fn: "sum" });
    const ratio = metric({
      id: "cr",
      metric_type: "calculated",
      data_type: "percent",
      dependencies: ["num", "den"],
    });

    const cells = buildMetricCells(
      [sum, ratio],
      { deals: 10, num: 5, den: 20 },
      { deals: 5, num: 2, den: 10 },
      1,
      1,
    );

    expect(Object.keys(cells)).toEqual(["deals", "cr"]);
    expect(cells.deals.current).toBe(10);
    expect(cells.deals.previous).toBe(5);
    expect(cells.deals.delta).toBe(5);
    expect(cells.deals.deltaPercent).toBe(100);

    expect(cells.cr.current).toBe(25);
    expect(cells.cr.previous).toBe(20);
    expect(cells.cr.delta).toBe(5);
    expect(cells.cr.deltaPercent).toBe(25);
  });
});
