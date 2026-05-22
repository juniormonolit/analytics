/**
 * Tests for `features/reports/colorRules.ts`.
 *
 * Two surfaces exist:
 *
 *   1. `getDeltaColor(metric, deltaPercent)` — the bucket logic. The
 *      `NEGATIVE_METRIC_IDS` allow-list is empty in v1, so every
 *      metric currently uses the default "up = positive, down =
 *      negative" rule. We verify that default rule directly + assert
 *      the v1 allow-list invariant so a future expansion has a
 *      deliberate failing test pointing it at this file.
 *
 *   2. `deltaColorToClass(color)` — pure mapping to design-token
 *      utility classes.
 */
import { describe, expect, it } from "vitest";

import {
  NEGATIVE_METRIC_IDS,
  deltaColorToClass,
  getDeltaColor,
  type DeltaColor,
} from "../colorRules";

const sampleMetric = (id = "incoming_deals_count") => ({ id });

describe("NEGATIVE_METRIC_IDS — v1 invariant", () => {
  it("is empty in v1 (set is sourced from sa.metrics.color_rules later)", () => {
    expect(NEGATIVE_METRIC_IDS.size).toBe(0);
  });
});

describe("getDeltaColor() — default rule (up = positive)", () => {
  it("returns 'positive' for a positive deltaPercent", () => {
    expect(getDeltaColor(sampleMetric(), 12.3)).toBe<DeltaColor>("positive");
  });

  it("returns 'negative' for a negative deltaPercent", () => {
    expect(getDeltaColor(sampleMetric(), -4.2)).toBe<DeltaColor>("negative");
  });

  it("returns 'neutral' for exactly 0", () => {
    expect(getDeltaColor(sampleMetric(), 0)).toBe<DeltaColor>("neutral");
  });

  it("returns null for null/undefined deltaPercent", () => {
    expect(getDeltaColor(sampleMetric(), null)).toBeNull();
    expect(getDeltaColor(sampleMetric(), undefined)).toBeNull();
  });

  it("returns null for non-finite deltaPercent (NaN, Infinity)", () => {
    expect(getDeltaColor(sampleMetric(), Number.NaN)).toBeNull();
    expect(getDeltaColor(sampleMetric(), Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("works for any metric id while NEGATIVE_METRIC_IDS is empty", () => {
    // Spot-check several distinct ids — v1 has no inversion rule.
    expect(getDeltaColor({ id: "won_deals_amount" }, 5)).toBe("positive");
    expect(getDeltaColor({ id: "refusals_count" }, 5)).toBe("positive");
    expect(getDeltaColor({ id: "lost_deals_amount" }, -3)).toBe("negative");
  });
});

describe("deltaColorToClass()", () => {
  it("maps 'positive' → text-positive token class", () => {
    expect(deltaColorToClass("positive")).toBe("text-positive");
  });

  it("maps 'negative' → text-negative token class", () => {
    expect(deltaColorToClass("negative")).toBe("text-negative");
  });

  it("maps 'neutral' → muted secondary text token class", () => {
    expect(deltaColorToClass("neutral")).toBe("text-text-secondary");
  });

  it("maps null → muted secondary text token class (collapses to neutral)", () => {
    expect(deltaColorToClass(null)).toBe("text-text-secondary");
  });
});
