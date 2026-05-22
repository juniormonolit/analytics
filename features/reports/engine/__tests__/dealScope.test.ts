import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEAL_SCOPE,
  normalizeMetricIdForDealScope,
  resolveDailySalesColumnValue,
  shouldSkipDailySalesColumnForScope,
  stripDealScopeSuffix,
  effectiveFunnelKindForScope,
} from "../dealScope";

describe("dealScope", () => {
  it("defaults to primary", () => {
    expect(DEFAULT_DEAL_SCOPE).toBe("primary");
  });

  it("strips (перв.) and (повт.) suffixes from labels", () => {
    expect(stripDealScopeSuffix("Продажи (перв.)")).toBe("Продажи");
    expect(stripDealScopeSuffix("Продажи (повт.)")).toBe("Продажи");
  });

  it("maps repeat metric ids to primary counterparts", () => {
    expect(normalizeMetricIdForDealScope("repeat_sales_count")).toBe(
      "primary_sales_count",
    );
  });

  it("skips repeat daily_sales columns for primary and all scopes", () => {
    expect(shouldSkipDailySalesColumnForScope("repeat_sales_count", "primary")).toBe(
      true,
    );
    expect(shouldSkipDailySalesColumnForScope("repeat_sales_count", "all")).toBe(
      true,
    );
    expect(shouldSkipDailySalesColumnForScope("primary_sales_count", "repeat")).toBe(
      true,
    );
  });

  it("merges primary and repeat columns when scope is all", () => {
    const sums = {
      primary_sales_count: 3,
      repeat_sales_count: 2,
    };
    expect(
      resolveDailySalesColumnValue(sums, "primary_sales_count", "all"),
    ).toBe(5);
    expect(
      resolveDailySalesColumnValue(sums, "repeat_sales_count", "all"),
    ).toBe(0);
  });

  it("uses repeat columns when scope is repeat", () => {
    const sums = {
      primary_sales_amount: 100,
      repeat_sales_amount: 40,
    };
    expect(
      resolveDailySalesColumnValue(sums, "primary_sales_amount", "repeat"),
    ).toBe(40);
  });

  it("global scope overrides metric funnelKind in drill-down", () => {
    expect(effectiveFunnelKindForScope("repeat", "primary")).toBe("repeat");
    expect(effectiveFunnelKindForScope("all", "primary")).toBeUndefined();
  });
});
