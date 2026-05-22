/**
 * Tests for `features/sales/state/reportPrefsStore.ts`.
 *
 * The store is a tiny Zustand singleton keyed by `ReportSlug`. We
 * reset it between tests by replacing `bySlug` with a freshly-built
 * default snapshot (mirrors the pattern used in
 * `features/sales/state/__tests__/filtersStore.test.ts`).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  safeMetricIds,
  selectPrefsFor,
  useReportPrefsStore,
} from "../reportPrefsStore";

const buildDefaultPrefs = () => ({
  metricIds: ["all_core"],
  columnOrder: [] as string[],
  hiddenColumns: [] as string[],
  columnWidths: {} as Record<string, number>,
  grouping: "none" as const,
  dealScope: "primary" as const,
  comparisonDisplay: "full" as const,
  sort: null,
});

const buildDefaultBySlug = () => ({
  "by-managers": buildDefaultPrefs(),
  "by-product-groups": buildDefaultPrefs(),
});

beforeEach(() => {
  useReportPrefsStore.setState({ bySlug: buildDefaultBySlug() });
});

describe("reportPrefsStore — initial state", () => {
  it("seeds both report slugs with sensible defaults", () => {
    const state = useReportPrefsStore.getState();
    expect(selectPrefsFor(state, "by-managers")).toEqual(buildDefaultPrefs());
    expect(selectPrefsFor(state, "by-product-groups")).toEqual(
      buildDefaultPrefs(),
    );
  });
});

describe("safeMetricIds()", () => {
  it("returns all_core for empty, null, or undefined input", () => {
    expect(safeMetricIds([])).toEqual(["all_core"]);
    expect(safeMetricIds(null)).toEqual(["all_core"]);
    expect(safeMetricIds(undefined)).toEqual(["all_core"]);
  });

  it("returns a copy of non-empty arrays", () => {
    const ids = ["incoming_deals_count"];
    expect(safeMetricIds(ids)).toEqual(["incoming_deals_count"]);
    ids.push("won_deals_amount");
    expect(safeMetricIds(["incoming_deals_count"])).toEqual([
      "incoming_deals_count",
    ]);
  });

  it("keeps called_deals_count and strips repeat-scope duplicate metrics", () => {
    expect(
      safeMetricIds([
        "incoming_deals_count",
        "called_deals_count",
        "repeat_deals_count",
      ]),
    ).toEqual(["incoming_deals_count", "called_deals_count"]);
  });
});

describe("setMetricIds()", () => {
  it("falls back to all_core when given an empty array", () => {
    useReportPrefsStore.getState().setMetricIds("by-managers", []);
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers").metricIds,
    ).toEqual(["all_core"]);
  });

  it("writes to the targeted slug only", () => {
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["incoming_deals_count", "won_deals_amount"]);

    const state = useReportPrefsStore.getState();
    expect(selectPrefsFor(state, "by-managers").metricIds).toEqual([
      "incoming_deals_count",
      "won_deals_amount",
    ]);
    expect(selectPrefsFor(state, "by-product-groups").metricIds).toEqual([
      "all_core",
    ]);
  });

  it("stores a copy of the array (defensive against caller mutation)", () => {
    const ids = ["a", "b", "c"];
    useReportPrefsStore.getState().setMetricIds("by-managers", ids);
    ids.push("d");
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers").metricIds,
    ).toEqual(["a", "b", "c"]);
  });
});

describe("setGrouping()", () => {
  it("updates only the grouping field of the targeted slug", () => {
    useReportPrefsStore.getState().setGrouping("by-managers", "team");
    const state = useReportPrefsStore.getState();
    expect(selectPrefsFor(state, "by-managers").grouping).toBe("team");
    // Sibling fields preserved.
    expect(selectPrefsFor(state, "by-managers").metricIds).toEqual([
      "all_core",
    ]);
    expect(selectPrefsFor(state, "by-managers").sort).toBeNull();
    // Other slug untouched.
    expect(selectPrefsFor(state, "by-product-groups").grouping).toBe("none");
  });
});

describe("setSort()", () => {
  it("writes a sort descriptor to the targeted slug", () => {
    const sort = {
      columnId: "metric:incoming_deals_count.current",
      direction: "desc" as const,
    };
    useReportPrefsStore.getState().setSort("by-managers", sort);
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers").sort,
    ).toEqual(sort);
  });

  it("can clear the sort with null", () => {
    useReportPrefsStore.getState().setSort("by-managers", {
      columnId: "dimension:manager_name",
      direction: "asc",
    });
    useReportPrefsStore.getState().setSort("by-managers", null);
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers").sort,
    ).toBeNull();
  });
});

describe("replaceForReport()", () => {
  it("replaces the entire prefs block for the slug", () => {
    useReportPrefsStore.getState().replaceForReport("by-managers", {
      metricIds: ["x", "y"],
      columnOrder: ["x", "y"],
      hiddenColumns: [],
      columnWidths: { manager_name: 220 },
      grouping: "total",
      sort: { columnId: "dimension:manager_name", direction: "asc" },
    });
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers"),
    ).toEqual({
      metricIds: ["x", "y"],
      columnOrder: ["x", "y"],
      hiddenColumns: [],
      columnWidths: { manager_name: 220 },
      grouping: "total",
      dealScope: "primary",
      comparisonDisplay: "full",
      sort: { columnId: "dimension:manager_name", direction: "asc" },
    });
  });

  it("leaves the other slug untouched", () => {
    useReportPrefsStore.getState().replaceForReport("by-managers", {
      metricIds: ["x"],
      columnOrder: [],
      hiddenColumns: [],
      columnWidths: {},
      grouping: "team",
      sort: null,
    });
    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-product-groups"),
    ).toEqual(buildDefaultPrefs());
  });
});

describe("reset()", () => {
  it("restores the targeted slug to default prefs", () => {
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["a", "b", "c"]);
    useReportPrefsStore.getState().setGrouping("by-managers", "team");
    useReportPrefsStore.getState().reset("by-managers");

    expect(
      selectPrefsFor(useReportPrefsStore.getState(), "by-managers"),
    ).toEqual(buildDefaultPrefs());
  });
});

describe("slug isolation", () => {
  it("two slugs maintain fully independent prefs", () => {
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["a", "b"]);
    useReportPrefsStore.getState().setGrouping("by-managers", "team");
    useReportPrefsStore.getState().setSort("by-managers", {
      columnId: "dimension:manager_name",
      direction: "asc",
    });

    useReportPrefsStore
      .getState()
      .setMetricIds("by-product-groups", ["x", "y", "z"]);
    useReportPrefsStore.getState().setGrouping("by-product-groups", "total");

    const state = useReportPrefsStore.getState();
    expect(selectPrefsFor(state, "by-managers")).toEqual({
      ...buildDefaultPrefs(),
      metricIds: ["a", "b"],
      grouping: "team",
      sort: { columnId: "dimension:manager_name", direction: "asc" },
    });
    expect(selectPrefsFor(state, "by-product-groups")).toEqual({
      ...buildDefaultPrefs(),
      metricIds: ["x", "y", "z"],
      grouping: "total",
    });
  });
});
