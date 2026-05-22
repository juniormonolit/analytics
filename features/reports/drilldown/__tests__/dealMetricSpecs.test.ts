import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRILLDOWN_METRIC_ID,
  getDealMetricFilterSpec,
  isDrillableDealMetric,
  resolveDrilldownMetricId,
} from "../dealMetricSpecs";

describe("dealMetricSpecs", () => {
  it("defaults missing metric id to primary deals", () => {
    expect(resolveDrilldownMetricId(undefined)).toBe(
      DEFAULT_DRILLDOWN_METRIC_ID,
    );
    expect(getDealMetricFilterSpec(undefined)?.kind).toBe("funnel");
  });

  it("treats incoming_deals_count as primary funnel filter", () => {
    expect(getDealMetricFilterSpec("incoming_deals_count")).toEqual({
      kind: "funnel",
      funnelKind: "primary",
    });
  });

  it("maps called_deals_count to called deal_events in period", () => {
    expect(getDealMetricFilterSpec("called_deals_count")).toEqual({
      kind: "deal_events",
      eventType: "called",
    });
  });

  it("maps reservations_count to reserved_at milestone date", () => {
    expect(getDealMetricFilterSpec("reservations_count")).toEqual({
      kind: "milestone_date",
      dateColumn: "reserved_at",
    });
  });

  it("maps sales metrics to sold_at milestone date", () => {
    expect(getDealMetricFilterSpec("primary_sales_count")).toEqual({
      kind: "milestone_date",
      dateColumn: "sold_at",
    });
    expect(getDealMetricFilterSpec("primary_sales_amount")).toEqual({
      kind: "milestone_date",
      dateColumn: "sold_at",
    });
  });

  it("maps shipments metrics to delivered_at milestone date", () => {
    expect(getDealMetricFilterSpec("primary_shipments_count")).toEqual({
      kind: "milestone_date",
      dateColumn: "delivered_at",
    });
    expect(getDealMetricFilterSpec("primary_shipments_amount")).toEqual({
      kind: "milestone_date",
      dateColumn: "delivered_at",
    });
  });

  it("recognises drillable deal metrics", () => {
    expect(isDrillableDealMetric("called_deals_count")).toBe(true);
    expect(isDrillableDealMetric("incoming_deals_count")).toBe(true);
    expect(isDrillableDealMetric("managers_per_day")).toBe(false);
  });
});
