"use client";

/**
 * Breadcrumb trail for the drill-down panel.
 *
 * Renders one button per stack entry. Clicking an earlier crumb pops
 * the stack to that depth (the button reads the index back via
 * `popTo`). The active (last) crumb is rendered as plain text since
 * clicking it would be a no-op.
 */
import { ChevronRight } from "lucide-react";

import {
  selectCurrentEntry,
  useDrilldownStore,
} from "@/features/sales/state/drilldownStore";

export function DrillDownBreadcrumbs() {
  const stack = useDrilldownStore((s) => s.stack);
  const popTo = useDrilldownStore((s) => s.popTo);
  const current = useDrilldownStore(selectCurrentEntry);

  if (stack.length === 0 || current === null) return null;

  return (
    <nav
      aria-label="Хлебные крошки детализации"
      className="flex flex-wrap items-center gap-1 text-xs text-text-secondary"
    >
      {stack.map((entry, index) => {
        const isLast = index === stack.length - 1;
        return (
          <span
            key={`crumb-${index}-${entry.label}`}
            className="inline-flex items-center gap-1"
          >
            {index > 0 ? (
              <ChevronRight
                className="h-3 w-3 text-text-muted"
                aria-hidden
              />
            ) : null}
            {isLast ? (
              <span
                aria-current="page"
                className="font-medium text-text-primary"
              >
                {entry.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => popTo(index)}
                className="rounded px-1 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
              >
                {entry.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
