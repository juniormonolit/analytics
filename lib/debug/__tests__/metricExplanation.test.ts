// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  explainMetricEngine,
  type DebugMetricRow,
} from "../metricExplanation";

function metric(overrides: Partial<DebugMetricRow> = {}): DebugMetricRow {
  return {
    id: "incoming_deals_count",
    name_ru: "Входящие сделки",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "int",
    aggregation_fn: "sum",
    source: "daily_sales",
    source_column: "incoming_deals_count",
    formula: null,
    dependencies: null,
    category: "Продажи",
    is_core: true,
    is_active: true,
    sort_order: 10,
    ...overrides,
  };
}

describe("explainMetricEngine", () => {
  it("explains primary_deals_count from sa.deals and funnels", () => {
    const explanation = explainMetricEngine(
      metric({ id: "primary_deals_count", source: "deals" }),
    );
    expect(explanation.relatedTable).toBe("deals");
    expect(explanation.sqlExplanation).toContain("primary_deals_count");
    expect(explanation.sqlExplanation).toContain("is_repeat = true");
  });

  it("explains legacy incoming_deals_count alias as primary deals", () => {
    const explanation = explainMetricEngine(
      metric({ id: "incoming_deals_count", source: "daily_sales" }),
    );
    expect(explanation.relatedTable).toBe("deals");
    expect(explanation.sqlExplanation).toContain("primary_deals_count");
  });

  it("explains repeat_deals_count", () => {
    const explanation = explainMetricEngine(
      metric({ id: "repeat_deals_count", source: "deals" }),
    );
    expect(explanation.relatedTable).toBe("deals");
    expect(explanation.sqlExplanation).toContain("repeat_deals_count");
  });

  it("explains called_deals_count from sa.deals and stages", () => {
    const explanation = explainMetricEngine(
      metric({ id: "called_deals_count", source: "deals" }),
    );
    expect(explanation.relatedTable).toBe("deals");
    expect(explanation.sqlExplanation).toContain("called_deals_count");
    expect(explanation.sqlExplanation).toContain("event_type = 'called'");
  });

  it("explains reservations_count from sa.deal_events history", () => {
    const explanation = explainMetricEngine(
      metric({ id: "reservations_count", source: "deal_events" }),
    );
    expect(explanation.relatedTable).toBe("deal_events");
    expect(explanation.sqlExplanation).toContain("reservations_count");
    expect(explanation.sqlExplanation).toContain("event_type = 'reserved'");
  });

  it("explains confirmed_reservations_count from sa.deal_events history", () => {
    const explanation = explainMetricEngine(
      metric({
        id: "confirmed_reservations_count",
        source: "deal_events",
      }),
    );
    expect(explanation.relatedTable).toBe("deal_events");
    expect(explanation.sqlExplanation).toContain("confirmed_reservations_count");
    expect(explanation.sqlExplanation).toContain("event_type = 'confirmed'");
  });

  it("explains sales amount from deals stage filter", () => {
    const explanation = explainMetricEngine(
      metric({
        id: "primary_sales_amount",
        source_column: "primary_sales_amount",
      }),
    );
    expect(explanation.relatedTable).toBe("deals");
    expect(explanation.sqlExplanation).toContain("sum(d.amount)");
    expect(explanation.sqlExplanation).toContain("event_type in ('sold', 'shipped')");
  });

  it("explains calculated metrics with dependencies", () => {
    const explanation = explainMetricEngine(
      metric({
        id: "conversion_rate",
        metric_type: "calculated",
        source: null,
        source_column: null,
        dependencies: ["incoming_deals_count", "won_deals_count"],
      }),
    );
    expect(explanation.sqlExplanation).toContain("numerator");
    expect(explanation.sqlExplanation).toContain("denominator");
  });
});

describe("saTables helpers", () => {
  it("validates debug table whitelist", async () => {
    const { isSaDebugTableName, parseSortParam } = await import("../saTables");
    expect(isSaDebugTableName("deals")).toBe(true);
    expect(isSaDebugTableName("unknown")).toBe(false);
    expect(parseSortParam("created_at.desc", "deals")).toEqual({
      column: "created_at",
      ascending: false,
    });
    expect(parseSortParam("bad.column", "deals").column).toBe("created_at");
  });
});
