/**
 * Tests for `lib/period/defaults.ts` — the canonical period helpers.
 *
 * These functions form the spec contract for the section-level filter
 * bar (BI-004), so the cases below are pinned against the explicit
 * scenarios called out in `ai_docs/01_PRODUCT_SPEC.md` and the
 * orchestration prompt.
 *
 * Note on the comparison rule: the implementation comment in
 * `defaults.ts` explicitly chooses "length-of-current-period anchored
 * to the end of the previous month" over the spec example's 29-day
 * comparison (29.04 → 03.03..31.03). We follow the implementation here
 * — see the deviations section in the test-writer report.
 */
import { describe, expect, it } from "vitest";

import {
  defaultComparisonPeriod,
  defaultPeriod,
  fromIso,
  recomputeComparison,
  toIso,
} from "../defaults";

/** Build a local-midnight Date with a 1-indexed month, for readability. */
function midnight(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day, 0, 0, 0, 0);
}

describe("toIso() / fromIso()", () => {
  it("toIso formats a Date as yyyy-MM-dd (zero-padded)", () => {
    expect(toIso(midnight(2026, 4, 1))).toBe("2026-04-01");
    expect(toIso(midnight(2026, 1, 9))).toBe("2026-01-09");
    expect(toIso(midnight(2026, 12, 31))).toBe("2026-12-31");
  });

  it("fromIso parses yyyy-MM-dd into a local Date", () => {
    const date = fromIso("2026-04-29");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(29);
  });

  it("toIso(fromIso(x)) is a round-trip", () => {
    for (const iso of ["2026-04-29", "2026-01-01", "2025-12-31", "2026-02-28"]) {
      expect(toIso(fromIso(iso))).toBe(iso);
    }
  });
});

describe("defaultPeriod() — spec contract", () => {
  it("today = 2026-04-29 (Wed) → { 2026-04-01 .. 2026-04-28 }", () => {
    expect(defaultPeriod(midnight(2026, 4, 29))).toEqual({
      from: "2026-04-01",
      to: "2026-04-28",
    });
  });

  it("today = 2026-05-15 → { 2026-05-01 .. 2026-05-14 } (14 days)", () => {
    expect(defaultPeriod(midnight(2026, 5, 15))).toEqual({
      from: "2026-05-01",
      to: "2026-05-14",
    });
  });

  it("edge case: today = 2026-01-01 → falls back to full previous month (Dec 2025)", () => {
    // When today is the 1st of the month there is no "yesterday" inside
    // the current month, so `defaultPeriod` falls back to the entire
    // previous month rather than producing an empty/inverted range.
    expect(defaultPeriod(midnight(2026, 1, 1))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("ignores the time portion of today (early morning vs late evening agree)", () => {
    const morning = new Date(2026, 3, 29, 1, 30, 0, 0);
    const evening = new Date(2026, 3, 29, 23, 59, 59, 999);
    expect(defaultPeriod(morning)).toEqual(defaultPeriod(evening));
  });
});

describe("recomputeComparison() — same-length tail of previous month", () => {
  it("28-day current period (Apr 1..28) → 28-day tail of March (Mar 4..31)", () => {
    const result = recomputeComparison(
      { from: "2026-04-01", to: "2026-04-28" },
      midnight(2026, 4, 29),
    );
    expect(result).toEqual({ from: "2026-03-04", to: "2026-03-31" });
  });

  it("5-day current period (Apr 5..9) → 5-day tail of March (Mar 27..31)", () => {
    const result = recomputeComparison(
      { from: "2026-04-05", to: "2026-04-09" },
      midnight(2026, 4, 10),
    );
    expect(result).toEqual({ from: "2026-03-27", to: "2026-03-31" });
  });

  it("1-day current period (single day) → last day of previous month, single day", () => {
    const result = recomputeComparison(
      { from: "2026-04-15", to: "2026-04-15" },
      midnight(2026, 4, 16),
    );
    expect(result).toEqual({ from: "2026-03-31", to: "2026-03-31" });
  });

  it("ignores `today` argument; anchored off period.from", () => {
    const range = { from: "2026-04-01", to: "2026-04-28" };
    const a = recomputeComparison(range, midnight(2026, 4, 29));
    const b = recomputeComparison(range, midnight(2099, 1, 1));
    expect(a).toEqual(b);
  });
});

describe("defaultComparisonPeriod()", () => {
  it("today = 2026-04-29 → 28-day tail of March (Mar 4..31)", () => {
    const today = midnight(2026, 4, 29);
    const period = defaultPeriod(today);
    expect(defaultComparisonPeriod(period, today)).toEqual({
      from: "2026-03-04",
      to: "2026-03-31",
    });
  });

  it("today = 2026-05-15 → last 14 days of April (Apr 17..30)", () => {
    const today = midnight(2026, 5, 15);
    const period = defaultPeriod(today);
    expect(defaultComparisonPeriod(period, today)).toEqual({
      from: "2026-04-17",
      to: "2026-04-30",
    });
  });

  it("edge case: today = 2026-01-01 → 31-day tail anchored at end of November (spans Oct→Nov)", () => {
    // The default period for 2026-01-01 is the *full* previous month
    // (31 days). The same-length tail anchored at `endOfMonth(prev) =
    // 2025-11-30` therefore goes back 30 days, landing on 2025-10-31.
    // This deviates from the worker prompt's stated expectation of a
    // pure November tail; we follow the implementation per the
    // "ADAPT the test, not the implementation" rule.
    const today = midnight(2026, 1, 1);
    const period = defaultPeriod(today);
    expect(defaultComparisonPeriod(period, today)).toEqual({
      from: "2025-10-31",
      to: "2025-11-30",
    });
  });
});
