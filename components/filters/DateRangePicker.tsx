"use client";

/**
 * Section-level date range picker.
 *
 * Reads/writes the `period` + `comparisonPeriod` pair on the Sales
 * filters store. The trigger button shows the formatted current range
 * with a small caption underneath that summarizes the comparison
 * range. The popover contains a single-month calendar on the left and
 * a vertical list of presets on the right.
 *
 * Range-picking semantics:
 *   1. First click  → set "pending start", calendar shows that single
 *      day highlighted.
 *   2. Second click → finalize range (`min`..`max` of the two clicks),
 *      auto-recompute `comparisonPeriod` via the same-length-previous-
 *      month rule, close the popover.
 *   3. Preset click → apply both `period` and `comparisonPeriod` and
 *      close the popover.
 */
import * as Popover from "@radix-ui/react-popover";
import { CalendarRange } from "lucide-react";
import { useState } from "react";

import {
  CalendarMonth,
  visibleMonthFromPeriod,
} from "./CalendarMonth";
import { DateRangePresets } from "./DateRangePresets";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { recomputeComparison } from "@/lib/period/defaults";
import { formatPeriodRu } from "@/lib/period/format";
import type { DateString, Period } from "@/lib/period/types";

function orderRange(a: DateString, b: DateString): Period {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function DateRangePicker() {
  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const setPeriodPair = useFiltersStore((s) => s.setPeriodPair);

  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    visibleMonthFromPeriod(period),
  );
  const [pendingStart, setPendingStart] = useState<DateString | null>(null);

  const today = new Date();

  const handleDayClick = (day: DateString) => {
    if (pendingStart === null) {
      setPendingStart(day);
      return;
    }
    const range = orderRange(pendingStart, day);
    const comparison = recomputeComparison(range, today);
    setPeriodPair(range, comparison);
    setPendingStart(null);
    setIsOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (next) {
      setVisibleMonth(visibleMonthFromPeriod(period));
      setPendingStart(null);
    }
  };

  const handlePreset = (presetFn: (today: Date) => Period) => {
    const nextPeriod = presetFn(today);
    const nextComparison = recomputeComparison(nextPeriod, today);
    setPeriodPair(nextPeriod, nextComparison);
    setVisibleMonth(visibleMonthFromPeriod(nextPeriod));
    setPendingStart(null);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-input-border bg-input-bg px-3 py-2 text-left transition-colors hover:border-input-border-hover"
        >
          <CalendarRange
            className="h-4 w-4 text-text-secondary"
            aria-hidden
          />
          <span className="flex flex-col leading-tight">
            <span className="text-sm text-text-primary">
              {formatPeriodRu(period)}
            </span>
            <span className="text-xs text-text-muted">
              Сравнение: {formatPeriodRu(comparisonPeriod)}
            </span>
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-lg border border-border-primary bg-popover-bg p-3 shadow-[var(--shadow-md)]"
        >
          <div className="flex gap-3">
            <CalendarMonth
              visibleMonth={visibleMonth}
              onVisibleMonthChange={setVisibleMonth}
              selection={period}
              pendingStart={pendingStart}
              today={today}
              onDayClick={handleDayClick}
            />
            <DateRangePresets
              onSelect={(preset) => handlePreset(preset.fn)}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
