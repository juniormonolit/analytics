"use client";

/**
 * One body row of the report table.
 */
import {
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { isDrillableDealMetric } from "@/features/reports/drilldown/dealMetricSpecs";
import { resolveMetricValueStyle } from "@/features/reports/metricColorSettings/gradient";
import type { MetricColorSettingsMap } from "@/features/reports/metricColorSettings/types";
import type { DrilldownStackEntry } from "@/features/reports/drilldown/types";
import {
  comparisonGrowthHasTrend,
  formatComparisonGrowthPercent,
  getComparisonDeltaColor,
} from "@/features/reports/comparisonTrend";
import {
  deltaColorToClass,
  type DeltaColor,
} from "@/features/reports/colorRules";
import type {
  DimensionColumn,
  MetricColumn,
  ReportSlug,
  Row as ReportRow,
} from "@/features/reports/engine/types";
import { useDrilldownStore } from "@/features/sales/state/drilldownStore";
import {
  formatCellValue,
  formatDelta,
} from "@/lib/format";

import { tableColumnCount } from "./reportTableLayout";

type ReportTableRowProps = {
  row: ReportRow;
  reportSlug: ReportSlug;
  dimensionColumns: DimensionColumn[];
  metricColumns: MetricColumn[];
  showComparison: boolean;
  metricColorSettingsById?: MetricColorSettingsMap;
};

function buildDrilldownEntry(
  reportSlug: ReportSlug,
  row: ReportRow,
  metric: MetricColumn,
): DrilldownStackEntry | null {
  if (row.rowKind === "groupLabel" || row.rowKind === "groupSubtotal") {
    return null;
  }
  if (!isDrillableDealMetric(metric.id)) return null;

  if (reportSlug === "by-managers") {
    const managerId = row.dimension.manager_id;
    if (typeof managerId !== "number") return null;
    const managerName = row.dimension.manager_name;
    return {
      level: "product-groups",
      rowKey: { managerId },
      label: typeof managerName === "string" ? managerName : `#${managerId}`,
      metricId: metric.id,
      metricLabel: metric.label,
    };
  }

  const groupId = row.dimension.product_group_id;
  if (typeof groupId !== "number") return null;
  const groupName = row.dimension.product_group_name;
  return {
    level: "managers",
    rowKey: { productGroupId: groupId },
    label: typeof groupName === "string" ? groupName : `#${groupId}`,
    metricId: metric.id,
    metricLabel: metric.label,
  };
}

function DeltaArrow({ color }: { color: DeltaColor }) {
  if (color === "positive") {
    return (
      <ArrowUp
        className="mr-0.5 inline-block h-3 w-3 align-[-1px]"
        aria-hidden
      />
    );
  }
  if (color === "negative") {
    return (
      <ArrowDown
        className="mr-0.5 inline-block h-3 w-3 align-[-1px]"
        aria-hidden
      />
    );
  }
  return (
    <Minus
      className="mr-0.5 inline-block h-3 w-3 align-[-1px]"
      aria-hidden
    />
  );
}

export function ReportTableRow({
  row,
  reportSlug,
  dimensionColumns,
  metricColumns,
  showComparison,
  metricColorSettingsById,
}: ReportTableRowProps) {
  const openDrilldown = (entry: DrilldownStackEntry) => {
    useDrilldownStore.getState().openFromRow(reportSlug, entry);
  };

  const colSpan = tableColumnCount(
    dimensionColumns,
    metricColumns.length,
    showComparison,
  );

  if (row.rowKind === "groupLabel") {
    return (
      <tr className="bg-table-header-bg">
        <td
          colSpan={colSpan}
          className="border-b border-table-border px-3 py-2 text-sm font-semibold text-text-primary"
        >
          {row.groupLabel ?? "—"}
        </td>
      </tr>
    );
  }

  const isSubtotal = row.rowKind === "groupSubtotal";

  return (
    <tr
      className={`group bg-table-bg transition-colors ${
        isSubtotal
          ? "border-t border-table-border bg-table-header-bg/40 font-medium"
          : "hover:bg-table-row-hover"
      }`}
    >
      {dimensionColumns.map((col, index) => {
        const value = row.dimension[col.key];
        const display =
          isSubtotal || value === null || value === undefined
            ? ""
            : String(value);
        const isFirst = index === 0;
        return (
          <td
            key={`row-dim-${row.key}-${col.key}`}
            className={`whitespace-nowrap border-b border-r border-table-border px-3 py-2 text-sm text-text-primary ${
              isFirst
                ? `sticky left-0 z-10 ${
                    isSubtotal
                      ? "bg-table-header-bg/40"
                      : "bg-table-bg group-hover:bg-table-row-hover"
                  }`
                : ""
            } ${isSubtotal ? "text-text-muted" : ""}`}
          >
            {display}
          </td>
        );
      })}
      {metricColumns.map((metric) => {
        const cell = row.metrics[metric.id];
        const current = cell?.current ?? null;
        const previous = cell?.previous ?? null;
        const delta = cell?.delta ?? null;
        const deltaPercent = cell?.deltaPercent ?? null;
        const comparisonCell = { current, previous, delta, deltaPercent };
        const color = getComparisonDeltaColor(metric, comparisonCell);
        const colorClass = deltaColorToClass(color);
        const drilldownEntry = buildDrilldownEntry(reportSlug, row, metric);
        const valueStyle = resolveMetricValueStyle(
          current,
          metricColorSettingsById?.[metric.id],
        );

        return (
          <ReportMetricCells
            key={`row-cell-${row.key}-${metric.id}`}
            metric={metric}
            current={current}
            previous={previous}
            delta={delta}
            deltaPercent={deltaPercent}
            colorClass={colorClass}
            color={color}
            valueStyle={valueStyle}
            showComparison={showComparison}
            emphasize={isSubtotal}
            onOpenDrilldown={
              drilldownEntry
                ? () => openDrilldown(drilldownEntry)
                : undefined
            }
          />
        );
      })}
    </tr>
  );
}

type ReportMetricCellsProps = {
  metric: MetricColumn;
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
  color: DeltaColor;
  colorClass: string;
  valueStyle?: { backgroundColor: string; color: string } | null;
  showComparison: boolean;
  emphasize?: boolean;
  onOpenDrilldown?: () => void;
};

export function ReportMetricCells({
  metric,
  current,
  previous,
  delta,
  deltaPercent,
  color,
  colorClass,
  valueStyle,
  showComparison,
  emphasize = false,
  onOpenDrilldown,
}: ReportMetricCellsProps) {
  const baseCellClass =
    "whitespace-nowrap border-b border-table-border px-3 py-2 text-right text-sm tabular-nums";
  const isDrillable = onOpenDrilldown !== undefined;

  const handleDrilldownClick = (event: MouseEvent) => {
    event.stopPropagation();
    onOpenDrilldown?.();
  };

  const handleDrilldownKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onOpenDrilldown?.();
    }
  };

  const comparisonCell = { current, previous, delta, deltaPercent };
  const growthText = formatComparisonGrowthPercent(
    comparisonCell,
    metric.decimalPlaces,
  );
  const showGrowthTrend = comparisonGrowthHasTrend(comparisonCell);

  return (
    <>
      <td
        className={`${baseCellClass} ${
          valueStyle ? "" : "text-text-primary"
        } ${
          showComparison ? "" : "border-r border-table-border"
        } ${emphasize ? "font-medium" : ""} ${
          isDrillable
            ? "cursor-pointer underline decoration-dotted decoration-text-muted underline-offset-2 hover:text-accent-primary"
            : ""
        }`}
        style={valueStyle ?? undefined}
        role={isDrillable ? "button" : undefined}
        tabIndex={isDrillable ? 0 : undefined}
        title={isDrillable ? "Открыть детализацию" : undefined}
        onClick={isDrillable ? handleDrilldownClick : undefined}
        onKeyDown={isDrillable ? handleDrilldownKeyDown : undefined}
      >
        {formatCellValue(current, metric.dataType, metric.decimalPlaces)}
      </td>
      {showComparison ? (
        <>
          <td className={`${baseCellClass} text-text-secondary ${emphasize ? "font-medium" : ""}`}>
            {formatCellValue(previous, metric.dataType, metric.decimalPlaces)}
          </td>
          <td className={`${baseCellClass} ${colorClass} ${emphasize ? "font-medium" : ""}`}>
            {formatDelta(delta, metric.dataType, metric.decimalPlaces)}
          </td>
          <td
            className={`${baseCellClass} border-r border-table-border ${colorClass} ${emphasize ? "font-medium" : ""}`}
          >
            {showGrowthTrend ? (
              <span className="inline-flex items-center justify-end">
                <DeltaArrow color={color} />
                <span>{growthText}</span>
              </span>
            ) : (
              growthText
            )}
          </td>
        </>
      ) : null}
    </>
  );
}
