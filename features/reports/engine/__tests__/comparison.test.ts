/**
 * Tests for `features/reports/engine/comparison.ts`.
 *
 * `mergeByDimension` is a pure helper: given current-period and
 * previous-period intermediate rows, produce a single list of merged
 * rows keyed by dimension key. Verifies the four cases that matter to
 * the engine pipeline:
 *
 *   1. Both sides have a row for the key → counts and raw maps merge.
 *   2. Only current has the key → previous side defaults to 0 / {}.
 *   3. Only previous has the key → current side defaults to 0 / {}.
 *   4. Dimension labels: current wins on conflicts; previous fills any
 *      keys current didn't carry.
 *
 * Plus an integration smoke test that pins the spec (03_REPORT_ENGINE):
 * when `mergeByDimension` is fed into `makeMetricCell`, current-only
 * rows produce `previous: 0` (not null) and previous-only rows
 * produce `current: 0`, with proper deltas.
 */
import { describe, expect, it } from "vitest";

import { makeMetricCell } from "../aggregate";
import { mergeByDimension } from "../comparison";
import type { MetricRow } from "../metricsCatalog";
import type { IntermediateRow } from "../types";

function sumMetric(id: string): MetricRow {
  return {
    id,
    name_ru: id,
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
  };
}

function row(
  key: string,
  count: number,
  raw: Record<string, number>,
  dimension: Record<string, string | number | null> = {},
): IntermediateRow {
  return { key, count, dimension, raw };
}

describe("mergeByDimension()", () => {
  it("merges rows present on both sides into a single MergedRow", () => {
    const current = [
      row("1", 5, { deals: 10 }, { manager_name: "Alice" }),
    ];
    const previous = [
      row("1", 3, { deals: 7 }, { manager_name: "Alice" }),
    ];

    const merged = mergeByDimension(current, previous);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      key: "1",
      currentCount: 5,
      previousCount: 3,
      currentRaw: { deals: 10 },
      previousRaw: { deals: 7 },
    });
    expect(merged[0].dimension).toEqual({ manager_name: "Alice" });
  });

  it("when only the current period has a row, previousCount=0 and previousRaw={}", () => {
    const current = [row("only-current", 4, { deals: 8 })];
    const merged = mergeByDimension(current, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].currentCount).toBe(4);
    expect(merged[0].previousCount).toBe(0);
    expect(merged[0].currentRaw).toEqual({ deals: 8 });
    expect(merged[0].previousRaw).toEqual({});
  });

  it("when only the previous period has a row, currentCount=0 and currentRaw={}", () => {
    const previous = [row("only-prev", 2, { deals: 5 })];
    const merged = mergeByDimension([], previous);
    expect(merged).toHaveLength(1);
    expect(merged[0].currentCount).toBe(0);
    expect(merged[0].previousCount).toBe(2);
    expect(merged[0].currentRaw).toEqual({});
    expect(merged[0].previousRaw).toEqual({ deals: 5 });
  });

  it("returns an empty array when both sides are empty", () => {
    expect(mergeByDimension([], [])).toEqual([]);
  });

  it("dimension labels: current side wins on conflicts; previous fills missing keys", () => {
    const current = [row("1", 1, {}, { manager_name: "Alice (current)" })];
    const previous = [
      row("1", 1, {}, { manager_name: "Alice (prev)", team_name: "Beta" }),
    ];

    const [merged] = mergeByDimension(current, previous);
    // Current's value for the same key wins…
    expect(merged.dimension.manager_name).toBe("Alice (current)");
    // …but a key that was only on the previous side is preserved.
    expect(merged.dimension.team_name).toBe("Beta");
  });

  it("delta math integrates: current-only sum metric → previous=0, delta=current, deltaPercent=null", () => {
    // Spec — ai_docs/03_REPORT_ENGINE.md:
    //   previous = rowPrevious[metricId] ?? 0
    //   delta    = current - previous
    //   deltaPercent = previous === 0 ? null : delta/previous*100
    const merged = mergeByDimension(
      [row("1", 1, { x: 10 })],
      [], // no previous
    );
    expect(merged[0].previousRaw.x).toBeUndefined();

    const cell = makeMetricCell(
      sumMetric("x"),
      merged[0].currentRaw,
      merged[0].previousRaw,
      merged[0].currentCount,
      merged[0].previousCount,
    );
    expect(cell.current).toBe(10);
    expect(cell.previous).toBe(0);
    expect(cell.delta).toBe(10);
    expect(cell.deltaPercent).toBeNull();
  });

  it("delta math integrates: previous-only sum metric → current=0, delta=-previous, deltaPercent=-100", () => {
    const merged = mergeByDimension(
      [], // no current
      [row("1", 1, { x: 25 })],
    );
    expect(merged[0].currentRaw.x).toBeUndefined();

    const cell = makeMetricCell(
      sumMetric("x"),
      merged[0].currentRaw,
      merged[0].previousRaw,
      merged[0].currentCount,
      merged[0].previousCount,
    );
    expect(cell.current).toBe(0);
    expect(cell.previous).toBe(25);
    expect(cell.delta).toBe(-25);
    expect(cell.deltaPercent).toBe(-100);
  });

  it("preserves multi-row independence (no cross-talk between keys)", () => {
    const current = [
      row("1", 2, { x: 5 }),
      row("2", 1, { x: 3 }),
    ];
    const previous = [
      row("2", 4, { x: 12 }),
      row("3", 1, { x: 7 }),
    ];

    const merged = mergeByDimension(current, previous);
    expect(merged.map((r) => r.key).sort()).toEqual(["1", "2", "3"]);

    const r1 = merged.find((r) => r.key === "1")!;
    expect(r1.currentRaw).toEqual({ x: 5 });
    expect(r1.previousRaw).toEqual({});

    const r2 = merged.find((r) => r.key === "2")!;
    expect(r2.currentRaw).toEqual({ x: 3 });
    expect(r2.previousRaw).toEqual({ x: 12 });

    const r3 = merged.find((r) => r.key === "3")!;
    expect(r3.currentRaw).toEqual({});
    expect(r3.previousRaw).toEqual({ x: 7 });
  });
});
