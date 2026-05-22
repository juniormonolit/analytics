"use client";

import { PRESETS, type Preset } from "@/lib/period/presets";

type DateRangePresetsProps = {
  onSelect: (preset: Preset) => void;
};

/**
 * Vertical list of date-range presets shown to the right of the
 * calendar inside `DateRangePicker`. Buttons are plain — selecting a
 * preset updates both `period` and `comparisonPeriod` in the store.
 */
export function DateRangePresets({ onSelect }: DateRangePresetsProps) {
  return (
    <div className="flex w-[160px] flex-col gap-1 border-l border-border-primary pl-3">
      <span className="px-2 pb-1 text-xs font-medium text-text-muted">
        Пресеты
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset)}
          className="rounded-md px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
