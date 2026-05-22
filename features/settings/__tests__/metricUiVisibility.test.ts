import { describe, expect, it } from "vitest";

import { CALLED_DEALS_METRIC_ID } from "@/features/reports/engine/dimensions/calledDeals";
import { REPEAT_SCOPE_METRIC_IDS } from "@/features/reports/engine/dealScope";

import {
  defaultVisibleInReportUi,
  filterMetricsForReportUi,
  hiddenMetricIdsForReportUi,
  isAlwaysHiddenFromReportUi,
  isVisibleInReportUi,
} from "../metricUiVisibility";

describe("metricUiVisibility", () => {
  it("shows called_deals_count by default", () => {
    expect(defaultVisibleInReportUi(CALLED_DEALS_METRIC_ID)).toBe(true);
    expect(isAlwaysHiddenFromReportUi(CALLED_DEALS_METRIC_ID)).toBe(false);
  });

  it("always hides repeat-scope duplicate metrics", () => {
    for (const id of REPEAT_SCOPE_METRIC_IDS) {
      expect(isAlwaysHiddenFromReportUi(id)).toBe(true);
      expect(defaultVisibleInReportUi(id)).toBe(false);
    }
  });

  it("respects user overrides from Settings", () => {
    const overrides = { [CALLED_DEALS_METRIC_ID]: false };
    expect(isVisibleInReportUi(CALLED_DEALS_METRIC_ID, overrides)).toBe(false);
    expect(
      hiddenMetricIdsForReportUi(
        [{ id: CALLED_DEALS_METRIC_ID }, { id: "incoming_deals_count" }],
        overrides,
      ),
    ).toEqual([CALLED_DEALS_METRIC_ID]);
  });

  it("filters catalog rows for report UI", () => {
    const rows = filterMetricsForReportUi(
      [
        { id: CALLED_DEALS_METRIC_ID },
        { id: "repeat_deals_count" },
        { id: "incoming_deals_count" },
      ],
      { incoming_deals_count: false },
    );
    expect(rows.map((row) => row.id)).toEqual([
      CALLED_DEALS_METRIC_ID,
    ]);
  });
});
