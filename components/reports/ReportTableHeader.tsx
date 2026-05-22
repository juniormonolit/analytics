"use client";

/**
 * Two-row sticky header for `<ReportTable />`.
 */
import { ChevronDown, ChevronUp } from "lucide-react";

import type {
  DimensionColumn,
  MetricColumn,
} from "@/features/reports/engine/types";
import type { SortDescriptor } from "@/features/sales/state/reportPrefsStore";

import {
  metricColumnSpan,
  metricSubHeadersForDisplay,
} from "./metricTableColumns";
import {
  dimensionColumnId,
  metricColumnId,
} from "./sorting";

type SortIndicatorProps = {
  active: boolean;
  direction?: "asc" | "desc";
};

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return (
      <span
        aria-hidden
        className="inline-block h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40"
      />
    );
  }
  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3 text-accent-primary" aria-hidden />
  ) : (
    <ChevronDown className="h-3 w-3 text-accent-primary" aria-hidden />
  );
}

type ReportTableHeaderProps = {
  dimensionColumns: DimensionColumn[];
  metricColumns: MetricColumn[];
  sort: SortDescriptor | null;
  showComparison: boolean;
  onSort: (columnId: string) => void;
};

export function ReportTableHeader({
  dimensionColumns,
  metricColumns,
  sort,
  showComparison,
  onSort,
}: ReportTableHeaderProps) {
  const subHeaders = metricSubHeadersForDisplay(showComparison);
  const colSpan = metricColumnSpan(showComparison);

  return (
    <thead className="sticky top-0 z-20 bg-table-header-bg">
      <tr>
        {dimensionColumns.map((col, index) => {
          const colId = dimensionColumnId(col.key);
          const isActive = sort?.columnId === colId;
          const isFirst = index === 0;
          return (
            <th
              key={`dim-${col.key}`}
              rowSpan={showComparison ? 2 : 1}
              scope="col"
              className={`group whitespace-nowrap border-b border-r border-table-border px-3 py-2 text-left align-middle text-xs font-semibold text-text-primary ${
                isFirst
                  ? "sticky left-0 z-30 bg-table-header-bg"
                  : "bg-table-header-bg"
              }`}
            >
              <button
                type="button"
                onClick={() => onSort(colId)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-primary transition-colors hover:text-accent-primary"
              >
                <span>{col.label}</span>
                <SortIndicator active={isActive} direction={sort?.direction} />
              </button>
            </th>
          );
        })}
        {metricColumns.map((metric) => {
          const colId = metricColumnId(metric.id, "current");
          const isActive = sort?.columnId === colId;
          return (
            <th
              key={`metric-h-${metric.id}`}
              colSpan={colSpan}
              scope="col"
              className="whitespace-nowrap border-b border-r border-table-border bg-table-header-bg px-3 py-2 text-center align-middle text-xs font-semibold text-text-primary"
            >
              {showComparison ? (
                <span title={metric.formula ?? metric.label}>{metric.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSort(colId)}
                  className="group inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-text-primary transition-colors hover:text-accent-primary"
                >
                  <span title={metric.formula ?? metric.label}>{metric.label}</span>
                  <SortIndicator active={isActive} direction={sort?.direction} />
                </button>
              )}
            </th>
          );
        })}
      </tr>
      {showComparison ? (
        <tr>
          {metricColumns.flatMap((metric) =>
            subHeaders.map((sub, idx) => {
              const colId = metricColumnId(metric.id, sub.kind);
              const isActive = sort?.columnId === colId;
              const isLastSub = idx === subHeaders.length - 1;
              return (
                <th
                  key={`metric-sub-${metric.id}-${sub.kind}`}
                  scope="col"
                  className={`whitespace-nowrap border-b border-table-border bg-table-header-bg px-3 py-1.5 text-right align-middle text-[11px] font-medium text-text-secondary ${
                    isLastSub ? "border-r" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(colId)}
                    className="group inline-flex w-full items-center justify-end gap-1 text-[11px] font-medium text-text-secondary transition-colors hover:text-accent-primary"
                  >
                    <span>{sub.label}</span>
                    <SortIndicator
                      active={isActive}
                      direction={sort?.direction}
                    />
                  </button>
                </th>
              );
            }),
          )}
        </tr>
      ) : null}
    </thead>
  );
}
