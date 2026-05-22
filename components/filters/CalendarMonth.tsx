"use client";

/**
 * Lightweight 6-week month grid used inside `DateRangePicker`.
 *
 * Why hand-rolled (instead of a library): the only state we need is
 * the focused month and the start/end of the active selection — both
 * are managed by the parent. This keeps the bundle small and makes
 * theming with design tokens straightforward.
 */
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { fromIso, toIso } from "@/lib/period/defaults";
import type { DateString, Period } from "@/lib/period/types";

const MONDAY: Parameters<typeof startOfWeek>[1] = { weekStartsOn: 1 };
const WEEKDAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

type CalendarMonthProps = {
  /** First-of-month anchor for the displayed grid. */
  visibleMonth: Date;
  onVisibleMonthChange: (next: Date) => void;
  /** Currently picked (full or partial) range. */
  selection: Period | null;
  /**
   * Day the user clicked first when picking a new range. While we are
   * waiting for the second click, this is the only highlighted day.
   */
  pendingStart: DateString | null;
  /** Today's local date — passed in for testability. */
  today: Date;
  onDayClick: (day: DateString) => void;
};

function buildCalendarDays(visibleMonth: Date): Date[] {
  const start = startOfWeek(startOfMonth(visibleMonth), MONDAY);
  const end = endOfWeek(endOfMonth(visibleMonth), MONDAY);
  return eachDayOfInterval({ start, end });
}

function isWithinRange(
  day: Date,
  range: { fromIso: string; toIso: string },
): boolean {
  const dayIso = toIso(day);
  return dayIso >= range.fromIso && dayIso <= range.toIso;
}

/**
 * Resolve the visible range used to color the "in-between" days. We
 * accept either:
 *   - a finalized `selection` (`Period`), or
 *   - a pending start (single anchored day, second pick not yet made).
 */
function resolveActiveRange(
  selection: Period | null,
  pendingStart: DateString | null,
): { fromIso: string; toIso: string } | null {
  if (pendingStart) {
    return { fromIso: pendingStart, toIso: pendingStart };
  }
  if (selection) {
    return { fromIso: selection.from, toIso: selection.to };
  }
  return null;
}

export function CalendarMonth({
  visibleMonth,
  onVisibleMonthChange,
  selection,
  pendingStart,
  today,
  onDayClick,
}: CalendarMonthProps) {
  const days = buildCalendarDays(visibleMonth);
  const activeRange = resolveActiveRange(selection, pendingStart);
  const monthLabel = format(visibleMonth, "LLLL yyyy");

  return (
    <div className="flex w-[280px] flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => onVisibleMonthChange(addMonths(visibleMonth, -1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-sm font-medium text-text-primary capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => onVisibleMonthChange(addMonths(visibleMonth, 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-text-muted">
        {WEEKDAY_LABELS_RU.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, visibleMonth);
          const isToday = isSameDay(day, today);
          const dayIso = toIso(day);
          const isStart = activeRange ? dayIso === activeRange.fromIso : false;
          const isEnd = activeRange ? dayIso === activeRange.toIso : false;
          const inRange = activeRange ? isWithinRange(day, activeRange) : false;
          const isEdge = isStart || isEnd;

          const baseClasses =
            "mx-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors";
          const monthClass = inMonth ? "" : "text-text-muted";
          const rangeClass = isEdge
            ? "bg-accent-primary text-text-on-accent"
            : inRange
              ? "bg-accent-soft text-accent-primary"
              : "text-text-primary hover:bg-bg-card-hover";
          const todayClass =
            isToday && !isEdge
              ? "ring-1 ring-accent-primary ring-inset"
              : "";

          return (
            <button
              key={dayIso}
              type="button"
              onClick={() => onDayClick(dayIso)}
              className={`${baseClasses} ${monthClass} ${rangeClass} ${todayClass}`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function visibleMonthFromPeriod(period: Period): Date {
  return startOfMonth(fromIso(period.from));
}
