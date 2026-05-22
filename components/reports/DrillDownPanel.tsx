"use client";

/**
 * Right-side slide-over drill-down panel.
 *
 * Built on `@radix-ui/react-dialog` (overlay, focus-trap, dismissal).
 * Radix Dialog has no native "side" prop — the right-anchored layout
 * is just a fixed-position container with full height.
 *
 * Composition:
 *   - Header: title (current label) + period range + close button.
 *   - Назад button (when stack depth > 1) + breadcrumbs.
 *   - Body: `<DrillDownLevelTable />` showing rows for the current
 *     level (loading / empty / error states handled inside).
 *
 * Mounted once at the bottom of `app/sales/layout.tsx` so it overlays
 * any sales report. Visibility is driven by `useDrilldownStore.open`.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, X } from "lucide-react";

import {
  selectCurrentEntry,
  useDrilldownStore,
} from "@/features/sales/state/drilldownStore";
import {
  selectPrefsFor,
  useReportPrefsStore,
} from "@/features/sales/state/reportPrefsStore";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { formatPeriodRu } from "@/lib/period/format";

import { DrillDownBreadcrumbs } from "./DrillDownBreadcrumbs";
import { DrillDownLevelTable } from "./DrillDownLevelTable";

export function DrillDownPanel() {
  const reportSlug = useDrilldownStore((s) => s.reportSlug);
  const open = useDrilldownStore((s) => s.open);
  const stack = useDrilldownStore((s) => s.stack);
  const current = useDrilldownStore(selectCurrentEntry);
  const close = useDrilldownStore((s) => s.close);
  const pop = useDrilldownStore((s) => s.pop);

  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const showComparison = useReportPrefsStore(
    (s) =>
      (reportSlug ? selectPrefsFor(s, reportSlug).comparisonDisplay : "full") ===
      "full",
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-screen w-[80vw] max-w-[80vw] flex-col border-l border-border-primary bg-modal-bg shadow-[var(--shadow-lg)] outline-none"
          aria-describedby={undefined}
        >
          <header className="flex items-start justify-between gap-2 border-b border-border-primary px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold text-text-primary">
                {current?.label ?? "Детализация"}
                {current?.metricLabel ? (
                  <span className="font-normal text-text-secondary">
                    {" "}
                    — {current.metricLabel}
                  </span>
                ) : null}
              </Dialog.Title>
              <p className="mt-0.5 text-xs text-text-secondary">
                {formatPeriodRu(period)}
              </p>
              {showComparison ? (
                <p className="text-[11px] text-text-muted">
                  Сравнение: {formatPeriodRu(comparisonPeriod)}
                </p>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Закрыть"
              className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="flex items-center gap-2 border-b border-border-primary px-4 py-2">
            {stack.length > 1 ? (
              <button
                type="button"
                onClick={pop}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              >
                <ChevronLeft className="h-3 w-3" aria-hidden />
                Назад
              </button>
            ) : null}
            <DrillDownBreadcrumbs />
          </div>

          {open ? <DrillDownLevelTable /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
