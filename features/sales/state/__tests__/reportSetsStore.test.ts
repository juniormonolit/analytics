import { describe, expect, it, beforeEach } from "vitest";

import { useReportSetsStore, applySavedReportSet } from "../reportSetsStore";

describe("reportSetsStore", () => {
  beforeEach(() => {
    useReportSetsStore.setState({
      sets: [],
      hydrationStatus: "idle",
      userKey: "local",
    });
  });

  it("saves and retrieves a report set", () => {
    const saved = useReportSetsStore.getState().saveSet({
      name: "Мой отчёт",
      reportSlug: "by-managers",
      metricIds: ["primary_sales_count"],
      grouping: "team",
      dealScope: "primary",
      comparisonDisplay: "full",
      teamIds: [],
    });

    expect(saved.id).toBeTruthy();
    expect(useReportSetsStore.getState().getSetById(saved.id)?.name).toBe(
      "Мой отчёт",
    );
  });

  it("deletes a saved set", () => {
    const saved = useReportSetsStore.getState().saveSet({
      name: "Удалить меня",
      reportSlug: "by-managers",
      metricIds: ["all_core"],
      grouping: "none",
      dealScope: "all",
      comparisonDisplay: "current",
      teamIds: ["22222222-2222-2222-2222-222222222222"],
    });

    useReportSetsStore.getState().deleteSet(saved.id);
    expect(useReportSetsStore.getState().getSetById(saved.id)).toBeUndefined();
  });

  it("applies saved set prefs and team ids", () => {
    const saved = useReportSetsStore.getState().saveSet({
      name: "С отделами",
      reportSlug: "by-managers",
      metricIds: ["primary_sales_count"],
      grouping: "team",
      dealScope: "primary",
      comparisonDisplay: "full",
      teamIds: ["11111111-1111-1111-1111-111111111111"],
    });

    const applied = applySavedReportSet(saved);
    expect(applied.metricIds).toEqual(["primary_sales_count"]);
    expect(applied.teamIds).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });
});
