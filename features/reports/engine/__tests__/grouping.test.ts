/**
 * Tests for `features/reports/engine/grouping.ts`.
 *
 * Three modes:
 *   - `none`  — pass-through, one Row per MergedRow.
 *   - `team`  — synthesizes a team-header row per `team_id` (correctly
 *               recomputing CR from numerator/denominator sums) and
 *               emits its members below with `groupKey` / `groupLabel`
 *               propagated.
 *   - `total` — collapses everything into a single `__totals__` row.
 *
 * The CR-correctness of the team header row is the most important
 * thing to pin: it's the same correctness rule as totals, just at the
 * group level.
 */
import { describe, expect, it } from "vitest";

import { applyGrouping, mergedRowToOutput } from "../grouping";
import type { MetricRow } from "../metricsCatalog";
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
  dimension: Record<string, string | number | null>,
  currentRaw: Record<string, number>,
  previousRaw: Record<string, number> = {},
  currentCount = 1,
  previousCount = 1,
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

const sumDeals = metric({ id: "deals", aggregation_fn: "sum" });
const cr = metric({
  id: "cr",
  metric_type: "calculated",
  data_type: "percent",
  dependencies: ["num", "den"],
});

describe("mergedRowToOutput()", () => {
  it("clones the dimension map and builds the metrics record", () => {
    const m = mergedRow(
      "1",
      { manager_name: "Alice" },
      { deals: 10 },
      { deals: 5 },
    );
    const row = mergedRowToOutput(m, [sumDeals]);
    expect(row.key).toBe("1");
    expect(row.dimension).toEqual({ manager_name: "Alice" });
    expect(row.dimension).not.toBe(m.dimension);
    expect(row.metrics.deals.current).toBe(10);
    expect(row.metrics.deals.previous).toBe(5);
  });
});

describe("applyGrouping('none')", () => {
  it("returns one Row per MergedRow, in input order, untouched", () => {
    const rows: MergedRow[] = [
      mergedRow("1", { manager_name: "A" }, { deals: 10 }),
      mergedRow("2", { manager_name: "B" }, { deals: 20 }),
    ];
    const out = applyGrouping(rows, "none", [sumDeals]);
    expect(out.rows).toHaveLength(2);
    expect(out.rows.map((r) => r.key)).toEqual(["1", "2"]);
    expect(out.rows[0].metrics.deals.current).toBe(10);
    // No grouping metadata should leak into 'none' mode.
    expect(out.rows[0].groupKey).toBeUndefined();
  });
});

describe("applyGrouping('total')", () => {
  it("returns exactly one totals row that aggregates all input rows", () => {
    const rows: MergedRow[] = [
      mergedRow("1", { manager_name: "A" }, { deals: 10 }, { deals: 5 }),
      mergedRow("2", { manager_name: "B" }, { deals: 20 }, { deals: 8 }),
    ];
    const out = applyGrouping(rows, "total", [sumDeals]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].key).toBe("__totals__");
    expect(out.rows[0].dimension).toEqual({});
    expect(out.rows[0].metrics.deals.current).toBe(30);
    expect(out.rows[0].metrics.deals.previous).toBe(13);
  });

  it("recomputes ratio metrics correctly at the totals level", () => {
    const rows: MergedRow[] = [
      mergedRow("1", {}, { num: 5, den: 10 }),
      mergedRow("2", {}, { num: 10, den: 100 }),
    ];
    const out = applyGrouping(rows, "total", [cr]);
    // (5 + 10) / (10 + 100) * 100 = 13.6363…
    expect(out.rows[0].metrics.cr.current).toBeCloseTo((15 / 110) * 100, 6);
  });
});

describe("applyGrouping('team')", () => {
  it("emits a label row, members, and a subtotal row per team", () => {
    const rows: MergedRow[] = [
      mergedRow(
        "10",
        { manager_name: "Alice", team_id: 1, team_name: "Alpha" },
        { deals: 10 },
        { deals: 5 },
      ),
      mergedRow(
        "11",
        { manager_name: "Bob", team_id: 1, team_name: "Alpha" },
        { deals: 20 },
        { deals: 6 },
      ),
      mergedRow(
        "20",
        { manager_name: "Charlie", team_id: 2, team_name: "Beta" },
        { deals: 5 },
        { deals: 1 },
      ),
    ];

    const out = applyGrouping(rows, "team", [sumDeals]);

    // 2 groups × (label + subtotal) + 3 members = 7 rows.
    expect(out.rows).toHaveLength(7);

    const alphaLabel = out.rows.find((r) => r.key === "teamLabel:1")!;
    expect(alphaLabel.rowKind).toBe("groupLabel");
    expect(alphaLabel.groupLabel).toBe("Alpha");
    expect(alphaLabel.metrics).toEqual({});

    const alphaSubtotal = out.rows.find((r) => r.key === "teamSubtotal:1")!;
    expect(alphaSubtotal.rowKind).toBe("groupSubtotal");
    expect(alphaSubtotal.metrics.deals.current).toBe(30);
    expect(alphaSubtotal.metrics.deals.previous).toBe(11);
    expect(alphaSubtotal.groupKey).toBe("1");

    const betaSubtotal = out.rows.find((r) => r.key === "teamSubtotal:2")!;
    expect(betaSubtotal.metrics.deals.current).toBe(5);

    const alphaBlock = out.rows.filter((r) => r.groupKey === "1");
    expect(alphaBlock.map((r) => r.key)).toEqual([
      "teamLabel:1",
      "10",
      "11",
      "teamSubtotal:1",
    ]);

    const alice = out.rows.find((r) => r.key === "10")!;
    expect(alice.rowKind).toBe("data");
    expect(alice.groupKey).toBe("1");
    expect(alice.groupLabel).toBe("Alpha");
  });

  it("recomputes ratio metrics correctly at the team subtotal row (not an average of children)", () => {
    const rows: MergedRow[] = [
      mergedRow(
        "10",
        { team_id: 1, team_name: "Alpha" },
        { num: 5, den: 10 },
      ),
      mergedRow(
        "11",
        { team_id: 1, team_name: "Alpha" },
        { num: 10, den: 100 },
      ),
    ];
    const out = applyGrouping(rows, "team", [cr]);
    const subtotal = out.rows.find((r) => r.key === "teamSubtotal:1")!;
    expect(subtotal.metrics.cr.current).toBeCloseTo((15 / 110) * 100, 6);
    expect(subtotal.metrics.cr.current).not.toBeCloseTo(30, 1);
  });

  it("buckets rows without a team_id under 'unknown' with a fallback Russian label", () => {
    const rows: MergedRow[] = [
      mergedRow("99", { manager_name: "Floater" }, { deals: 4 }),
    ];
    const out = applyGrouping(rows, "team", [sumDeals]);
    const label = out.rows.find((r) => r.key === "teamLabel:unknown")!;
    expect(label).toBeDefined();
    expect(label.groupKey).toBe("unknown");
    expect(label.groupLabel).toMatch(/Команда unknown/);
  });
});
