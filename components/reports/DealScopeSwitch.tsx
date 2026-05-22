"use client";

/**
 * Three-pill segmented control for primary / repeat / all deal scope.
 */
import {
  useReportPrefsStore,
  selectPrefsFor,
} from "@/features/sales/state/reportPrefsStore";
import type {
  DealScope,
  ReportSlug,
} from "@/features/reports/engine/types";

import {
  TOOLBAR_SEGMENTED,
  toolbarSegmentedButtonClass,
} from "./toolbarStyles";

const OPTIONS: ReadonlyArray<{ value: DealScope; label: string }> = [
  { value: "primary", label: "Первичные" },
  { value: "repeat", label: "Повторные" },
  { value: "all", label: "Все" },
];

type DealScopeSwitchProps = {
  reportSlug: ReportSlug;
};

export function DealScopeSwitch({ reportSlug }: DealScopeSwitchProps) {
  const prefs = useReportPrefsStore((s) => selectPrefsFor(s, reportSlug));
  const setDealScope = useReportPrefsStore((s) => s.setDealScope);

  return (
    <div
      role="radiogroup"
      aria-label="Тип сделок"
      className={TOOLBAR_SEGMENTED}
    >
      {OPTIONS.map((opt) => {
        const isActive = prefs.dealScope === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setDealScope(reportSlug, opt.value)}
            className={toolbarSegmentedButtonClass(isActive)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
