"use client";

/**
 * Sticky totals row anchored at the bottom of the table body.
 *
 * The shape of the cells is identical to a normal row, but the first
 * cell is replaced with the «Итого» label spanning all dimension
 * columns. Renders inside `<tfoot>` so it stays at the bottom and we
 * can sticky-position it independently of the header.
 */
import type {
  DimensionColumn,
  MetricColumn,
  Row as ReportRow,
} from "@/features/reports/engine/types";
import {
  getComparisonDeltaColor,
} from "@/features/reports/comparisonTrend";
import { deltaColorToClass } from "@/features/reports/colorRules";
import { resolveMetricValueStyle } from "@/features/reports/metricColorSettings/gradient";
import type { MetricColorSettingsMap } from "@/features/reports/metricColorSettings/types";

import { ReportMetricCells } from "./ReportTableRow";

type ReportTableTotalsProps = {
  totals: ReportRow;
  dimensionColumns: DimensionColumn[];
  metricColumns: MetricColumn[];
  showComparison: boolean;
  metricColorSettingsById?: MetricColorSettingsMap;
};

export function ReportTableTotals({
  totals,
  dimensionColumns,
  metricColumns,
  showComparison,
  metricColorSettingsById,
}: ReportTableTotalsProps) {
  return (
    <tfoot className="sticky bottom-0 z-10">
      <tr className="bg-table-header-bg">
        <td
          colSpan={dimensionColumns.length}
          className="sticky left-0 z-10 whitespace-nowrap border-t border-r border-table-border bg-table-header-bg px-3 py-2 text-sm font-semibold text-text-primary"
        >
          Итого
        </td>
        {metricColumns.map((metric) => {
          const cell = totals.metrics[metric.id];
          const current = cell?.current ?? null;
          const previous = cell?.previous ?? null;
          const delta = cell?.delta ?? null;
          const deltaPercent = cell?.deltaPercent ?? null;
          const comparisonCell = { current, previous, delta, deltaPercent };
          const color = getComparisonDeltaColor(metric, comparisonCell);
          const colorClass = deltaColorToClass(color);
          const valueStyle = resolveMetricValueStyle(
            current,
            metricColorSettingsById?.[metric.id],
          );

          return (
            <ReportMetricCells
              key={`totals-${metric.id}`}
              metric={metric}
              current={current}
              previous={previous}
              delta={delta}
              deltaPercent={deltaPercent}
              colorClass={colorClass}
              color={color}
              valueStyle={valueStyle}
              showComparison={showComparison}
            />
          );
        })}
      </tr>
    </tfoot>
  );
}
