"use client";

import {
  useReportPrefsStore,
  selectPrefsFor,
  type ComparisonDisplay,
} from "@/features/sales/state/reportPrefsStore";
import type { ReportSlug } from "@/features/reports/engine/types";

import {
  TOOLBAR_SEGMENTED,
  toolbarSegmentedButtonClass,
} from "./toolbarStyles";

const OPTIONS: ReadonlyArray<{ value: ComparisonDisplay; label: string }> = [
  { value: "full", label: "С сравнением" },
  { value: "current", label: "Без сравнения" },
];

type ComparisonDisplaySwitchProps = {
  reportSlug: ReportSlug;
};

export function ComparisonDisplaySwitch({
  reportSlug,
}: ComparisonDisplaySwitchProps) {
  const prefs = useReportPrefsStore((s) => selectPrefsFor(s, reportSlug));
  const setComparisonDisplay = useReportPrefsStore(
    (s) => s.setComparisonDisplay,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Отображение сравнения"
      className={TOOLBAR_SEGMENTED}
    >
      {OPTIONS.map((opt) => {
        const isActive = prefs.comparisonDisplay === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setComparisonDisplay(reportSlug, opt.value)}
            className={toolbarSegmentedButtonClass(isActive)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
