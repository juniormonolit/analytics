/**
 * Tests for `lib/period/format.ts`.
 *
 * The Russian human-format helpers are pure string transformations,
 * so we just pin a few representative cases — including zero-padding
 * for single-digit days/months and the em-dash separator inside
 * `formatPeriodRu`.
 */
import { describe, expect, it } from "vitest";

import { formatDayRu, formatPeriodRu } from "../format";

describe("formatDayRu()", () => {
  it("formats a yyyy-MM-dd ISO string as dd.MM.yyyy", () => {
    expect(formatDayRu("2026-04-01")).toBe("01.04.2026");
  });

  it("zero-pads single-digit day and month", () => {
    expect(formatDayRu("2026-01-09")).toBe("09.01.2026");
  });

  it("handles end-of-year boundary", () => {
    expect(formatDayRu("2025-12-31")).toBe("31.12.2025");
  });
});

describe("formatPeriodRu()", () => {
  it("uses an em dash (U+2014) between the formatted endpoints", () => {
    const result = formatPeriodRu({ from: "2026-04-01", to: "2026-04-28" });
    expect(result).toBe("01.04.2026 — 28.04.2026");
    // Sanity check: em dash, not hyphen / minus / en dash.
    expect(result).toContain("\u2014");
  });

  it("formats a single-day period (from === to) as identical endpoints", () => {
    expect(formatPeriodRu({ from: "2026-04-29", to: "2026-04-29" })).toBe(
      "29.04.2026 — 29.04.2026",
    );
  });

  it("preserves chronological direction (does not auto-swap)", () => {
    // We don't expect callers to pass an inverted range; but if they
    // do, the formatter is a pure mapping and prints what it gets.
    expect(formatPeriodRu({ from: "2026-03-04", to: "2026-03-31" })).toBe(
      "04.03.2026 — 31.03.2026",
    );
  });
});
