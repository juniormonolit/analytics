/**
 * Period domain types — shared across the date-range filter, presets,
 * comparison logic, and the report engine.
 *
 * `Period` is intentionally a pair of ISO strings (`yyyy-MM-dd`) rather
 * than `Date` objects so the value can flow through URL search params,
 * Zustand state, and JSON request/response bodies without serialization
 * ambiguity. Convert to `Date` only inside pure formatting/arithmetic
 * helpers, never at the boundary.
 */

/** ISO calendar day in `yyyy-MM-dd` format (e.g. `"2026-04-28"`). */
export type DateString = string;

/** Inclusive period defined by ISO calendar days. */
export type Period = {
  from: DateString;
  to: DateString;
};
