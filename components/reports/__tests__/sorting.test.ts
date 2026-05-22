/**
 * Tests for `components/reports/sorting.ts` — pure helpers for the
 * report table's sort UX.
 *
 * Public API (per source):
 *   - `dimensionColumnId(key)` / `metricColumnId(metricId, sub)`
 *   - `extractSortValue(row, columnId)`
 *   - `sortRows(rows, descriptor)`
 *   - `toggleSort(current, columnId)`
 *
 * Note (deviation): the BI-006 spec mentions `encodeColumnId` /
 * `decodeColumnId` / `compareRows`. The worker chose differently —
 * the encoding helpers are split into `dimensionColumnId` /
 * `metricColumnId`, and there is no public `decodeColumnId` because
 * `extractSortValue` reads the encoded id directly. We test the
 * actual public API.
 */
import { describe, expect, it } from "vitest";

import type { Row } from "@/features/reports/engine/types";
import type { SortDescriptor } from "@/features/sales/state/reportPrefsStore";

import {
  dimensionColumnId,
  extractSortValue,
  metricColumnId,
  sortRows,
  sortTeamGroupedRows,
  toggleSort,
} from "../sorting";

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

describe("dimensionColumnId()", () => {
  it("encodes a dimension key as `dimension:<key>`", () => {
    expect(dimensionColumnId("manager_name")).toBe("dimension:manager_name");
  });
});

describe("metricColumnId()", () => {
  it("encodes a metric + sub kind as `metric:<id>.<sub>`", () => {
    expect(metricColumnId("incoming_deals_count", "current")).toBe(
      "metric:incoming_deals_count.current",
    );
    expect(metricColumnId("incoming_deals_count", "deltaPercent")).toBe(
      "metric:incoming_deals_count.deltaPercent",
    );
  });
});

// ---------------------------------------------------------------------------
// extractSortValue — substitute for the spec's `decodeColumnId` (the
// project codebase reads addressed values directly without a public
// decode step).
// ---------------------------------------------------------------------------

const buildRow = (overrides: Partial<Row> = {}): Row => ({
  key: "row-1",
  dimension: { manager_name: "Анна", manager_id: 7 },
  metrics: {
    incoming_deals_count: {
      current: 100,
      previous: 80,
      delta: 20,
      deltaPercent: 25,
    },
  },
  ...overrides,
});

describe("extractSortValue()", () => {
  it("addresses a dimension cell by `dimension:<key>`", () => {
    expect(extractSortValue(buildRow(), "dimension:manager_name")).toBe(
      "Анна",
    );
    expect(extractSortValue(buildRow(), "dimension:manager_id")).toBe(7);
  });

  it("returns null when the addressed dimension key is missing", () => {
    expect(extractSortValue(buildRow(), "dimension:unknown")).toBeNull();
  });

  it("addresses each metric sub-column", () => {
    const row = buildRow();
    expect(
      extractSortValue(row, "metric:incoming_deals_count.current"),
    ).toBe(100);
    expect(
      extractSortValue(row, "metric:incoming_deals_count.previous"),
    ).toBe(80);
    expect(
      extractSortValue(row, "metric:incoming_deals_count.delta"),
    ).toBe(20);
    expect(
      extractSortValue(row, "metric:incoming_deals_count.deltaPercent"),
    ).toBe(25);
  });

  it("returns null for an unknown column id prefix", () => {
    expect(extractSortValue(buildRow(), "garbage:thing")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sortRows — equivalent to the spec's `compareRows`. We exercise both
// dimension and metric columns + asc/desc directions.
// ---------------------------------------------------------------------------

const rowA = (): Row => ({
  key: "a",
  dimension: { manager_name: "Анна" },
  metrics: {
    incoming_deals_count: {
      current: 100,
      previous: 80,
      delta: 20,
      deltaPercent: 25,
    },
  },
});
const rowB = (): Row => ({
  key: "b",
  dimension: { manager_name: "Борис" },
  metrics: {
    incoming_deals_count: {
      current: 50,
      previous: 80,
      delta: -30,
      deltaPercent: -37.5,
    },
  },
});
const rowC = (): Row => ({
  key: "c",
  dimension: { manager_name: "Виктор" },
  metrics: {
    incoming_deals_count: {
      current: 75,
      previous: 80,
      delta: -5,
      deltaPercent: -6.25,
    },
  },
});

describe("sortRows() on a dimension column", () => {
  it("sorts ascending using ru-RU collation", () => {
    const sorted = sortRows([rowB(), rowC(), rowA()], {
      columnId: "dimension:manager_name",
      direction: "asc",
    });
    expect(sorted.map((r) => r.key)).toEqual(["a", "b", "c"]); // Анна, Борис, Виктор
  });

  it("sorts descending using ru-RU collation", () => {
    const sorted = sortRows([rowA(), rowB(), rowC()], {
      columnId: "dimension:manager_name",
      direction: "desc",
    });
    expect(sorted.map((r) => r.key)).toEqual(["c", "b", "a"]);
  });
});

describe("sortRows() on a metric sub-column", () => {
  it("sorts ascending by metric.current", () => {
    const sorted = sortRows([rowA(), rowB(), rowC()], {
      columnId: "metric:incoming_deals_count.current",
      direction: "asc",
    });
    expect(sorted.map((r) => r.key)).toEqual(["b", "c", "a"]); // 50, 75, 100
  });

  it("sorts descending by metric.deltaPercent", () => {
    const sorted = sortRows([rowA(), rowB(), rowC()], {
      columnId: "metric:incoming_deals_count.deltaPercent",
      direction: "desc",
    });
    // 25, -6.25, -37.5
    expect(sorted.map((r) => r.key)).toEqual(["a", "c", "b"]);
  });
});

describe("sortRows() — null handling and identity", () => {
  it("returns a copy when the descriptor is null (does not mutate input)", () => {
    const input: SortDescriptor | null = null;
    const rows = [rowA(), rowB()];
    const sorted = sortRows(rows, input);
    expect(sorted).not.toBe(rows);
    expect(sorted.map((r) => r.key)).toEqual(["a", "b"]);
  });
});

describe("sortTeamGroupedRows()", () => {
  const teamRows = (): Row[] => [
    {
      key: "teamLabel:1",
      rowKind: "groupLabel",
      dimension: {},
      metrics: {},
      groupKey: "1",
      groupLabel: "Alpha",
    },
    {
      key: "m-a",
      rowKind: "data",
      dimension: { manager_name: "Alice" },
      metrics: {
        incoming_deals_count: {
          current: 10,
          previous: null,
          delta: null,
          deltaPercent: null,
        },
      },
      groupKey: "1",
    },
    {
      key: "teamSubtotal:1",
      rowKind: "groupSubtotal",
      dimension: {},
      metrics: {
        incoming_deals_count: {
          current: 10,
          previous: null,
          delta: null,
          deltaPercent: null,
        },
      },
      groupKey: "1",
    },
    {
      key: "teamLabel:2",
      rowKind: "groupLabel",
      dimension: {},
      metrics: {},
      groupKey: "2",
      groupLabel: "Beta",
    },
    {
      key: "m-b",
      rowKind: "data",
      dimension: { manager_name: "Bob" },
      metrics: {
        incoming_deals_count: {
          current: 50,
          previous: null,
          delta: null,
          deltaPercent: null,
        },
      },
      groupKey: "2",
    },
    {
      key: "teamSubtotal:2",
      rowKind: "groupSubtotal",
      dimension: {},
      metrics: {
        incoming_deals_count: {
          current: 50,
          previous: null,
          delta: null,
          deltaPercent: null,
        },
      },
      groupKey: "2",
    },
  ];

  it("reorders whole groups by subtotal while keeping label/member/subtotal together", () => {
    const sorted = sortTeamGroupedRows(teamRows(), {
      columnId: "metric:incoming_deals_count.current",
      direction: "desc",
    });
    expect(sorted.map((r) => r.key)).toEqual([
      "teamLabel:2",
      "m-b",
      "teamSubtotal:2",
      "teamLabel:1",
      "m-a",
      "teamSubtotal:1",
    ]);
  });
});

// ---------------------------------------------------------------------------
// initial direction for a freshly clicked column (sensible for the
// numeric metric columns that dominate the table).
// ---------------------------------------------------------------------------

describe("toggleSort()", () => {
  it("starts in 'desc' when there is no current sort", () => {
    expect(toggleSort(null, "dimension:manager_name")).toEqual({
      columnId: "dimension:manager_name",
      direction: "desc",
    });
  });

  it("starts in 'desc' when clicking a different column from the active one", () => {
    expect(
      toggleSort(
        { columnId: "dimension:manager_name", direction: "asc" },
        "metric:incoming_deals_count.current",
      ),
    ).toEqual({
      columnId: "metric:incoming_deals_count.current",
      direction: "desc",
    });
  });

  it("flips desc → asc on the active column", () => {
    expect(
      toggleSort(
        { columnId: "metric:incoming_deals_count.current", direction: "desc" },
        "metric:incoming_deals_count.current",
      ),
    ).toEqual({
      columnId: "metric:incoming_deals_count.current",
      direction: "asc",
    });
  });

  it("flips asc → desc on the active column", () => {
    expect(
      toggleSort(
        { columnId: "metric:incoming_deals_count.current", direction: "asc" },
        "metric:incoming_deals_count.current",
      ),
    ).toEqual({
      columnId: "metric:incoming_deals_count.current",
      direction: "desc",
    });
  });
});
