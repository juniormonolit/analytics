/**
 * Pure period helpers used to derive default current/comparison ranges
 * and to recompute the comparison range whenever the current period
 * changes.
 *
 * No React/Next imports — these are deterministic functions of `(today)`
 * and the current `Period`, which makes them trivial to unit-test.
 *
 * Conventions:
 * - All inputs and outputs are ISO `yyyy-MM-dd` strings (`Period`).
 * - The "comparison" rule is "same-length tail of the previous month",
 *   defined explicitly in `recomputeComparison` and reused everywhere.
 */
import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import type { DateString, Period } from "./types";

const ISO_DATE = "yyyy-MM-dd";

/** Format a `Date` as the canonical ISO calendar-day string. */
export function toIso(date: Date): DateString {
  return format(date, ISO_DATE);
}

/** Parse an ISO calendar-day string into a `Date` at local-time midnight. */
export function fromIso(date: DateString): Date {
  return parseISO(date);
}

/**
 * Default "current period" — `[1st of current month .. yesterday]`.
 *
 * Edge case: when `today` is the 1st of the month there is no
 * "yesterday" inside the current month, so we fall back to the entire
 * previous month (`[1st of prev month .. last day of prev month]`).
 * This matches the product spec's "compare equal-length ranges" intent
 * and avoids producing an empty/inverted range.
 */
export function defaultPeriod(today: Date): Period {
  const todayMidnight = startOfDay(today);
  const monthStart = startOfMonth(todayMidnight);

  if (todayMidnight.getTime() === monthStart.getTime()) {
    const prevMonth = subMonths(todayMidnight, 1);
    return {
      from: toIso(startOfMonth(prevMonth)),
      to: toIso(endOfMonth(prevMonth)),
    };
  }

  return {
    from: toIso(monthStart),
    to: toIso(subDays(todayMidnight, 1)),
  };
}

/**
 * Recompute the "same-length tail of the previous month" comparison
 * range for an arbitrary `Period`. The length (in calendar days) of
 * `period` is computed inclusively, then the comparison ends on the
 * last day of the previous month and goes back exactly that many days.
 *
 * Example: `period = 2026-04-01..2026-04-28` (28 days)
 *   → previous month is March 2026
 *   → comparison ends on 2026-03-31
 *   → comparison starts on 2026-03-31 - 27 = 2026-03-04
 *
 * Note: the spec's example (29.04.2026 → comparison 03.03..31.03) uses
 * 29 days inclusive (01.04..28.04 + 1 day shift for the cursor
 * position), but the canonical math is "length(period) days, anchored
 * to the end of the previous month". `today` is accepted for symmetry
 * with `defaultComparisonPeriod`; the previous-month anchor is derived
 * from `period.from` so the comparison stays coherent even when the
 * user manually picks a range that spans calendar months.
 */
export function recomputeComparison(period: Period, _today: Date): Period {
  const from = fromIso(period.from);
  const to = fromIso(period.to);
  const lengthDays = differenceInCalendarDays(to, from) + 1;

  const prevMonthEnd = endOfMonth(subMonths(from, 1));
  const prevMonthStart = subDays(prevMonthEnd, lengthDays - 1);

  return {
    from: toIso(prevMonthStart),
    to: toIso(prevMonthEnd),
  };
}

/**
 * Default comparison period for a default current period.
 *
 * Thin wrapper around `recomputeComparison` so call sites can express
 * intent ("default comparison for `period`") without importing two
 * helpers.
 */
export function defaultComparisonPeriod(period: Period, today: Date): Period {
  return recomputeComparison(period, today);
}

/**
 * Strip the time portion from a `Date` while keeping it in the local
 * timezone. We avoid `date-fns/startOfDay` here because it allocates a
 * new `Date` only when needed; this version is a small helper inlined
 * into the module.
 */
function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}
