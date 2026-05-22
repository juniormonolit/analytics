"use client";

/**
 * Compact totals layout for `grouping === "total"`.
 *
 * Renders a vertical metric list instead of the wide horizontal table.
 */
import { useMemo } from "react";

import type {
  MetricColumn,
  Row as ReportRow,
} from "@/features/reports/engine/types";
import { useTeamsTree } from "@/features/sales/hooks/useTeamsTree";
import {
  formatComparisonGrowthPercent,
  getComparisonDeltaColor,
} from "@/features/reports/comparisonTrend";
import {
  deltaColorToClass,
} from "@/features/reports/colorRules";
import {
  formatCellValue,
  formatDelta,
  formatDeltaPercent,
} from "@/lib/format";

import { formatTeamScopeLabel } from "./teamScopeLabel";

type ReportTableTotalViewProps = {
  row: ReportRow;
  metricColumns: MetricColumn[];
  teamIds: readonly number[];
  showComparison: boolean;
};

export function ReportTableTotalView({
  row,
  metricColumns,
  teamIds,
  showComparison,
}: ReportTableTotalViewProps) {
  const { data: teamsCatalog } = useTeamsTree();
  const scopeLabel = useMemo(
    () => formatTeamScopeLabel(teamsCatalog, teamIds),
    [teamsCatalog, teamIds],
  );

  return (
    <div className="p-4">
      <p className="mb-4 text-sm font-semibold leading-snug text-text-primary">
        {scopeLabel}
      </p>
      <table className="w-auto min-w-[360px] max-w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-table-border text-xs text-text-secondary">
            <th className="px-3 py-2 text-left font-medium">Показатель</th>
            <th className="px-3 py-2 text-right font-medium">Текущий</th>
            {showComparison ? (
              <>
                <th className="px-3 py-2 text-right font-medium">Сравнение</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
                <th className="px-3 py-2 text-right font-medium">Δ%</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {metricColumns.map((metric) => {
            const cell = row.metrics[metric.id];
            const current = cell?.current ?? null;
            const previous = cell?.previous ?? null;
            const delta = cell?.delta ?? null;
            const deltaPercent = cell?.deltaPercent ?? null;
            const comparisonCell = { current, previous, delta, deltaPercent };
            const color = getComparisonDeltaColor(metric, comparisonCell);
            const colorClass = deltaColorToClass(color);
            const growthText = formatComparisonGrowthPercent(
              comparisonCell,
              metric.decimalPlaces,
            );

            return (
              <tr
                key={`total-metric-${metric.id}`}
                className="border-b border-table-border"
              >
                <td className="px-3 py-2 text-sm text-text-primary">
                  {metric.label}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums text-text-primary">
                  {formatCellValue(
                    current,
                    metric.dataType,
                    metric.decimalPlaces,
                  )}
                </td>
                {showComparison ? (
                  <>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-text-secondary">
                      {formatCellValue(
                        previous,
                        metric.dataType,
                        metric.decimalPlaces,
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right text-sm tabular-nums ${colorClass}`}
                    >
                      {formatDelta(delta, metric.dataType, metric.decimalPlaces)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right text-sm tabular-nums ${colorClass}`}
                    >
                      {growthText}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
