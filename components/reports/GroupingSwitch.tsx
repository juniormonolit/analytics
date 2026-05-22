"use client";

/**
 * Three-pill segmented control for the grouping mode.
 */
import {
  useReportPrefsStore,
  selectPrefsFor,
} from "@/features/sales/state/reportPrefsStore";
import type {
  Grouping,
  ReportSlug,
} from "@/features/reports/engine/types";

import {
  TOOLBAR_SEGMENTED,
  toolbarSegmentedButtonClass,
} from "./toolbarStyles";

const OPTIONS: ReadonlyArray<{ value: Grouping; label: string }> = [
  { value: "none", label: "Нет" },
  { value: "team", label: "Отдел" },
  { value: "total", label: "Итого" },
];

type GroupingSwitchProps = {
  reportSlug: ReportSlug;
};

export function GroupingSwitch({ reportSlug }: GroupingSwitchProps) {
  const prefs = useReportPrefsStore((s) => selectPrefsFor(s, reportSlug));
  const setGrouping = useReportPrefsStore((s) => s.setGrouping);

  return (
    <div
      role="radiogroup"
      aria-label="Группировка"
      className={TOOLBAR_SEGMENTED}
    >
      {OPTIONS.map((opt) => {
        const isActive = prefs.grouping === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setGrouping(reportSlug, opt.value)}
            className={toolbarSegmentedButtonClass(isActive)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
