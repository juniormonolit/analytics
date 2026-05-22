/**
 * Russian-style human formatting for periods and individual ISO days.
 * Used by `DateRangePicker`, the FilterBar, and any view that needs to
 * show a date to the user (`dd.MM.yyyy`).
 */
import { format } from "date-fns";

import { fromIso } from "./defaults";
import type { DateString, Period } from "./types";

const RU_DAY = "dd.MM.yyyy";

/**
 * Format an ISO calendar-day string in `dd.MM.yyyy` (e.g. `01.04.2026`).
 */
export function formatDayRu(date: DateString): string {
  return format(fromIso(date), RU_DAY);
}

/**
 * Format a `Period` as `"01.04.2026 — 28.04.2026"` (em dash separator).
 */
export function formatPeriodRu(period: Period): string {
  return `${formatDayRu(period.from)} — ${formatDayRu(period.to)}`;
}
