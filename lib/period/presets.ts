/**
 * Six fixed presets shown next to the calendar in `DateRangePicker`.
 *
 * Each preset is a pure function `(today) → Period`, so the whole
 * catalog stays deterministic and easy to test/snapshot.
 */
import {
  endOfWeek,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

import { toIso } from "./defaults";
import type { Period } from "./types";

/** Locale-aware Monday-start config for `date-fns` week helpers. */
const MONDAY: Parameters<typeof startOfWeek>[1] = { weekStartsOn: 1 };

export type PresetId =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth";

export type Preset = {
  id: PresetId;
  /** Russian label rendered in the popover. */
  label: string;
  fn: (today: Date) => Period;
};

function singleDay(date: Date): Period {
  const iso = toIso(date);
  return { from: iso, to: iso };
}

export function preset_today(today: Date): Period {
  return singleDay(today);
}

export function preset_yesterday(today: Date): Period {
  return singleDay(subDays(today, 1));
}

export function preset_thisWeek(today: Date): Period {
  return {
    from: toIso(startOfWeek(today, MONDAY)),
    to: toIso(today),
  };
}

export function preset_lastWeek(today: Date): Period {
  const lastWeekAnchor = subWeeks(today, 1);
  return {
    from: toIso(startOfWeek(lastWeekAnchor, MONDAY)),
    to: toIso(endOfWeek(lastWeekAnchor, MONDAY)),
  };
}

export function preset_thisMonth(today: Date): Period {
  return {
    from: toIso(startOfMonth(today)),
    to: toIso(today),
  };
}

export function preset_lastMonth(today: Date): Period {
  const prev = subMonths(today, 1);
  return {
    from: toIso(startOfMonth(prev)),
    to: toIso(endOfMonth(prev)),
  };
}

/**
 * Display order matches the product spec / UI mockups.
 */
export const PRESETS: readonly Preset[] = [
  { id: "today", label: "Сегодня", fn: preset_today },
  { id: "yesterday", label: "Вчера", fn: preset_yesterday },
  { id: "thisWeek", label: "Эта неделя", fn: preset_thisWeek },
  { id: "lastWeek", label: "Прошлая неделя", fn: preset_lastWeek },
  { id: "thisMonth", label: "Этот месяц", fn: preset_thisMonth },
  { id: "lastMonth", label: "Прошлый месяц", fn: preset_lastMonth },
] as const;
