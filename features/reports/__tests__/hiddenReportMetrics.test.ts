import { describe, expect, it } from "vitest";

import { CALLED_DEALS_METRIC_ID } from "@/features/reports/engine/dimensions/calledDeals";

import {
  filterVisibleReportMetrics,
  isHiddenReportMetric,
  stripHiddenReportMetricIds,
} from "../hiddenReportMetrics";

describe("hiddenReportMetrics", () => {
  it("does not hide called_deals_count by default", () => {
    expect(isHiddenReportMetric(CALLED_DEALS_METRIC_ID)).toBe(false);
    expect(isHiddenReportMetric("incoming_deals_count")).toBe(false);
  });

  it("still hides repeat-scope duplicate metrics", () => {
    expect(isHiddenReportMetric("repeat_deals_count")).toBe(true);
  });

  it("filters repeat metrics from catalog rows", () => {
    const rows = [
      { id: "incoming_deals_count" },
      { id: CALLED_DEALS_METRIC_ID },
      { id: "repeat_deals_count" },
    ];
    expect(filterVisibleReportMetrics(rows).map((row) => row.id)).toEqual([
      "incoming_deals_count",
      CALLED_DEALS_METRIC_ID,
    ]);
  });

  it("strips hidden metric ids from saved prefs while keeping all_core", () => {
    expect(
      stripHiddenReportMetricIds([
        "all_core",
        "incoming_deals_count",
        CALLED_DEALS_METRIC_ID,
        "repeat_deals_count",
      ]),
    ).toEqual(["all_core", "incoming_deals_count", CALLED_DEALS_METRIC_ID]);
  });
});
