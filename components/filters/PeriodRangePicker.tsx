"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { formatPeriodRu } from "@/lib/period/format";
import type { DateString, Period } from "@/lib/period/types";

import {
  CalendarMonth,
  visibleMonthFromPeriod,
} from "./CalendarMonth";
import { DateRangePresets } from "./DateRangePresets";
import { orderRange, RANGE_PICKER_TRIGGER_CLASS } from "./rangePickerShared";

export function PeriodRangePicker() {
  const period = useFiltersStore((s) => s.period);
  const setPeriodOnly = useFiltersStore((s) => s.setPeriodOnly);

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
    setPeriodOnly(orderRange(pendingStart, day));
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
    setPeriodOnly(nextPeriod);
    setVisibleMonth(visibleMonthFromPeriod(nextPeriod));
    setPendingStart(null);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" className={RANGE_PICKER_TRIGGER_CLASS}>
          <CalendarRange className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          <span>{formatPeriodRu(period)}</span>
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
            <DateRangePresets onSelect={(preset) => handlePreset(preset.fn)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
