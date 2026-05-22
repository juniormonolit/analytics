/**
 * Tests for the ru-RU formatter helpers in `lib/format/*`.
 *
 * Implementation uses `Intl.NumberFormat("ru-RU", ...)`, which on
 * Node ≥ 18 emits the **non-breaking space** `U+00A0` as the thousand
 * separator. To stay portable across Node minor versions (some emit
 * `U+202F` narrow no-break space instead), every assertion uses a
 * tolerant regex — `\s` matches both — while a couple of cases pin
 * the actual probed string for an exact-equality smoke check.
 */
import { describe, expect, it } from "vitest";

import {
  formatNumber,
  formatMoney,
  formatPercent,
  formatDelta,
  formatDeltaPercent,
  formatCellValue,
} from "../index";

const EM_DASH = "\u2014";
const MINUS = "\u2212"; // Real Unicode minus sign (NOT ASCII "-").
const NBSP = "\u00A0";

describe("formatNumber", () => {
  it("formats integers with a ru-RU thousand separator (whitespace + grouping)", () => {
    const out = formatNumber(1234);
    // Tolerant: matches NBSP, narrow NBSP, or plain space.
    expect(out).toMatch(/^1\s234$/);
  });

  it("matches the Node v18+ narrow non-breaking-space output exactly", () => {
    // Pinned smoke check — if Node ever changes its default separator
    // this assertion will flag the change explicitly.
    expect(formatNumber(1234)).toBe(`1${NBSP}234`);
  });

  it("formats with N decimal places using the ru-RU comma decimal mark", () => {
    const out = formatNumber(1234.567, { decimalPlaces: 2 });
    expect(out).toMatch(/^1\s234,57$/);
  });

  it("returns the em-dash placeholder for null", () => {
    expect(formatNumber(null)).toBe(EM_DASH);
  });

  it("returns the em-dash placeholder for undefined", () => {
    expect(formatNumber(undefined)).toBe(EM_DASH);
  });

  it("returns the em-dash placeholder for non-finite numbers", () => {
    expect(formatNumber(Number.NaN)).toBe(EM_DASH);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(EM_DASH);
  });
});

describe("formatMoney", () => {
  it("contains both the grouped digits and the ruble symbol", () => {
    const out = formatMoney(1234567);
    // Digits with optional whitespace separators between groups.
    expect(out).toMatch(/1\s?234\s?567/);
    expect(out).toContain("₽");
  });

  it("returns the em-dash placeholder for null", () => {
    expect(formatMoney(null)).toBe(EM_DASH);
  });

  it("returns the em-dash placeholder for non-finite numbers", () => {
    expect(formatMoney(Number.NaN)).toBe(EM_DASH);
  });
});

describe("formatPercent", () => {
  it("formats with one decimal by default and the ru-RU comma + percent sign", () => {
    const out = formatPercent(12.3, { decimalPlaces: 1 });
    expect(out).toMatch(/^12,3\s*%$/);
  });

  it("defaults to one decimal when decimalPlaces is omitted", () => {
    expect(formatPercent(12.3)).toMatch(/^12,3\s*%$/);
  });

  it("returns the em-dash placeholder for null", () => {
    expect(formatPercent(null)).toBe(EM_DASH);
  });
});

describe("formatDelta", () => {
  it("prefixes positive values with a plus sign", () => {
    const out = formatDelta(1234, "int", 0);
    expect(out.startsWith("+")).toBe(true);
    expect(out).toMatch(/^\+1\s234$/);
  });

  it("prefixes negative values with the real Unicode minus (U+2212)", () => {
    const out = formatDelta(-1234, "int", 0);
    expect(out).toContain(MINUS);
    expect(out.charCodeAt(0)).toBe(0x2212);
    expect(out).not.toMatch(/^-/); // No ASCII hyphen.
  });

  it("returns zero without a sign prefix", () => {
    const out = formatDelta(0, "int", 0);
    expect(out.startsWith("+")).toBe(false);
    expect(out.startsWith(MINUS)).toBe(false);
    expect(out).toMatch(/^0$/);
  });

  it("returns the em-dash placeholder for null", () => {
    expect(formatDelta(null, "int", 0)).toBe(EM_DASH);
  });

  it("uses formatMoney for the 'money' dataType (preserves ruble sign)", () => {
    const out = formatDelta(2500, "money", 0);
    expect(out.startsWith("+")).toBe(true);
    expect(out).toContain("₽");
  });
});

describe("formatDeltaPercent", () => {
  it("prefixes positive values with '+' and renders the percent sign", () => {
    expect(formatDeltaPercent(12.3)).toMatch(/^\+12,3\s*%$/);
  });

  it("prefixes negative values with the real Unicode minus", () => {
    const out = formatDeltaPercent(-5);
    expect(out.startsWith(MINUS)).toBe(true);
    expect(out).toMatch(/^\u22125,0\s*%$/);
  });

  it("returns zero without a sign prefix", () => {
    expect(formatDeltaPercent(0)).toMatch(/^0,0\s*%$/);
  });

  it("returns the em-dash placeholder for null", () => {
    expect(formatDeltaPercent(null)).toBe(EM_DASH);
  });
});

describe("formatCellValue dispatch", () => {
  it("dispatches 'money' to formatMoney (ruble + grouping)", () => {
    const out = formatCellValue(1234567, "money", 0);
    expect(out).toContain("₽");
    expect(out).toMatch(/1\s?234\s?567/);
  });

  it("dispatches 'percent' to formatPercent", () => {
    const out = formatCellValue(12.3, "percent", 1);
    expect(out).toMatch(/^12,3\s*%$/);
  });

  it("dispatches 'int' to formatNumber with decimalPlaces=0 regardless of input", () => {
    // Even if a caller passes a higher decimalPlaces, 'int' must round
    // to 0 decimals per the ai_docs/04_METRICS.md spec.
    const out = formatCellValue(1234.7, "int", 3);
    expect(out).toMatch(/^1\s235$/);
  });

  it("dispatches 'decimal' to formatNumber with the supplied decimalPlaces", () => {
    expect(formatCellValue(1234.5, "decimal", 1)).toMatch(/^1\s234,5$/);
  });

  it("falls back to formatNumber for 'months' (decimal-style)", () => {
    expect(formatCellValue(12.34, "months", 1)).toMatch(/^12,3$/);
  });

  it("returns the em-dash placeholder for null on every dataType", () => {
    expect(formatCellValue(null, "money", 0)).toBe(EM_DASH);
    expect(formatCellValue(null, "percent", 1)).toBe(EM_DASH);
    expect(formatCellValue(null, "int", 0)).toBe(EM_DASH);
    expect(formatCellValue(null, "decimal", 2)).toBe(EM_DASH);
    expect(formatCellValue(null, "months", 1)).toBe(EM_DASH);
  });

  it("returns the em-dash placeholder for non-finite inputs", () => {
    expect(formatCellValue(Number.NaN, "decimal", 2)).toBe(EM_DASH);
    expect(formatCellValue(Number.POSITIVE_INFINITY, "money", 0)).toBe(EM_DASH);
  });
});
