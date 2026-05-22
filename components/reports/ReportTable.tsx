"use client";

/**
 * Top-level data table for the Sales section.
 *
 * Composes:
 *   - `useFiltersStore` (period + departments — section-scoped)
 *   - `useReportPrefsStore` (metricIds, grouping, sort — UI-only)
 *   - `useReportQuery` (the actual data fetch)
 *
 * Renders one of four states (loading / error / empty / ready) so
 * callers don't have to think about it.
 */
import { useMemo } from "react";

import {
  useReportPrefsStore,
  selectPrefsFor,
  safeMetricIds,
} from "@/features/sales/state/reportPrefsStore";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { hiddenMetricIdsForReportUi } from "@/features/settings/metricUiVisibility";
import { useMetricUiVisibility } from "@/features/settings/hooks/useMetricUiVisibility";
import { useMetricColorSettings } from "@/features/settings/hooks/useMetricColorSettings";
import { useMetricsCatalog } from "@/features/reports/useMetricsCatalog";
import { useReportQuery } from "@/features/reports/useReportQuery";
import type {
  ReportSlug,
  RunReportRequest,
} from "@/features/reports/engine/types";

import { ReportTableHeader } from "./ReportTableHeader";
import { ReportTableRow } from "./ReportTableRow";
import { ReportTableTotals } from "./ReportTableTotals";
import { ReportTableTotalView } from "./ReportTableTotalView";
import { visibleDimensionColumns } from "./reportTableLayout";
import { sortRowsForGrouping, toggleSort } from "./sorting";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { TableSkeleton } from "./states/TableSkeleton";

type ReportTableProps = {
  reportSlug: ReportSlug;
};

export function ReportTable({ reportSlug }: ReportTableProps) {
  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const teamIds = useFiltersStore((s) => s.teamIds);

  const prefs = useReportPrefsStore((s) => selectPrefsFor(s, reportSlug));
  const setSort = useReportPrefsStore((s) => s.setSort);
  const { overrides: visibilityOverrides } = useMetricUiVisibility();
  const { settingsByMetricId } = useMetricColorSettings();
  const { data: metricsCatalog } = useMetricsCatalog();

  const uiHiddenMetricIds = useMemo(
    () =>
      hiddenMetricIdsForReportUi(
        metricsCatalog?.metrics ?? [],
        visibilityOverrides,
      ),
    [metricsCatalog?.metrics, visibilityOverrides],
  );

  const request: RunReportRequest = useMemo(
    () => ({
      sectionSlug: "sales",
      reportSlug,
      period,
      comparisonPeriod,
      filters: { teamIds },
      metricIds: safeMetricIds(prefs.metricIds),
      grouping: prefs.grouping,
      dealScope: prefs.dealScope,
      uiHiddenMetricIds,
    }),
    [
      reportSlug,
      period,
      comparisonPeriod,
      teamIds,
      prefs.metricIds,
      prefs.grouping,
      prefs.dealScope,
      uiHiddenMetricIds,
    ],
  );

  const { data, isLoading, error, refetch, isFetching } = useReportQuery(
    request,
  );

  const sortedRows = useMemo(
    () =>
      data
        ? sortRowsForGrouping(data.rows, prefs.sort, prefs.grouping)
        : [],
    [data, prefs.sort, prefs.grouping],
  );

  const handleSort = (columnId: string) => {
    setSort(reportSlug, toggleSort(prefs.sort, columnId));
  };

  const showComparison = (prefs.comparisonDisplay ?? "full") === "full";

  const dimensionColumns = useMemo(
    () =>
      data
        ? visibleDimensionColumns(data.columns.dimension, prefs.grouping)
        : [],
    [data, prefs.grouping],
  );

  if (isLoading) {
    return <TableSkeleton />;
  }
  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!data) {
    return <TableSkeleton />;
  }
  if (data.rows.length === 0) {
    return <EmptyState />;
  }

  if (prefs.grouping === "total") {
    const totalsRow = data.rows[0];
    return (
      <div
        className="relative h-full overflow-auto rounded-md border border-table-border bg-table-bg"
        aria-busy={isFetching ? "true" : "false"}
      >
        <ReportTableTotalView
          row={totalsRow}
          metricColumns={data.columns.metrics}
          teamIds={teamIds}
          showComparison={showComparison}
        />
      </div>
    );
  }

  return (
    <div
      className="relative h-full overflow-auto rounded-md border border-table-border bg-table-bg"
      aria-busy={isFetching ? "true" : "false"}
    >
      <table className="w-full border-collapse text-left">
        <ReportTableHeader
          dimensionColumns={dimensionColumns}
          metricColumns={data.columns.metrics}
          sort={prefs.sort}
          showComparison={showComparison}
          onSort={handleSort}
        />
        <tbody>
          {sortedRows.map((row) => (
            <ReportTableRow
              key={row.key}
              row={row}
              reportSlug={reportSlug}
              dimensionColumns={dimensionColumns}
              metricColumns={data.columns.metrics}
              showComparison={showComparison}
              metricColorSettingsById={settingsByMetricId}
            />
          ))}
        </tbody>
        {data.totals ? (
          <ReportTableTotals
            totals={data.totals}
            dimensionColumns={dimensionColumns}
            metricColumns={data.columns.metrics}
            showComparison={showComparison}
            metricColorSettingsById={settingsByMetricId}
          />
        ) : null}
      </table>
    </div>
  );
}
