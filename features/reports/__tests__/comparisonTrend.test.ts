import { describe, expect, it } from "vitest";

import {
  formatComparisonGrowthPercent,
  getComparisonDeltaColor,
  isGrowthFromZero,
} from "../comparisonTrend";

const metric = { id: "cr" };

describe("isGrowthFromZero", () => {
  it("is true when previous is 0 and current is non-zero", () => {
    expect(
      isGrowthFromZero({
        current: 11.5,
        previous: 0,
        delta: 11.5,
        deltaPercent: null,
      }),
    ).toBe(true);
  });

  it("is false when both periods are zero", () => {
    expect(
      isGrowthFromZero({
        current: 0,
        previous: 0,
        delta: 0,
        deltaPercent: null,
      }),
    ).toBe(false);
  });
});

describe("getComparisonDeltaColor", () => {
  it("colors positive delta green when deltaPercent is null (from-zero base)", () => {
    expect(
      getComparisonDeltaColor(metric, {
        current: 8,
        previous: 0,
        delta: 8,
        deltaPercent: null,
      }),
    ).toBe("positive");
  });

  it("keeps using deltaPercent when available", () => {
    expect(
      getComparisonDeltaColor(metric, {
        current: 120,
        previous: 100,
        delta: 20,
        deltaPercent: 20,
      }),
    ).toBe("positive");
  });
});

describe("formatComparisonGrowthPercent", () => {
  it("shows infinity growth when the comparison base is zero", () => {
    expect(
      formatComparisonGrowthPercent({
        current: 11.5,
        previous: 0,
        delta: 11.5,
        deltaPercent: null,
      }),
    ).toBe("+∞");
  });
});
