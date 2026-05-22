"use client";

/**
 * Table body inside `<DrillDownPanel />`.
 *
 * Renders one of three layouts depending on the current stack entry:
 *
 *   - `level === "product-groups"` or `"managers"` — an aggregate
 *     table with the synthetic `Кол-во сделок` and `Сумма сделок`
 *     metrics. Clicking a row pushes the next level (deals) onto the
 *     stack via `useDrilldownStore`.
 *
 *   - `level === "deals"` — a flat table of individual deals with
 *     joined `stage_name` / `product_group_name`, ordered by
 *     `created_at desc`. Footer renders «Показано N из M» plus a
 *     «Загрузить ещё» button that increments the request offset.
 *
 * Loading / empty / error states reuse the same components as
 * `<ReportTable />`.
 */
import { useMemo, useState, type ReactNode } from "react";

import {
  DrillDownRootTabs,
  type DrillDownRootTab,
} from "@/components/reports/DrillDownRootTabs";
import {
  getComparisonDeltaColor,
} from "@/features/reports/comparisonTrend";
import {
  deltaColorToClass,
} from "@/features/reports/colorRules";
import {
  useDrilldownQuery,
} from "@/features/reports/useDrilldownQuery";
import type {
  DealRow,
  DrilldownAggregateResponse,
  DrilldownDealsResponse,
  DrilldownRequest,
} from "@/features/reports/drilldown/types";
import type {
  DimensionColumn,
  MetricCell,
  MetricColumn,
} from "@/features/reports/engine/types";
import {
  selectCurrentEntry,
  useDrilldownStore,
} from "@/features/sales/state/drilldownStore";
import {
  useReportPrefsStore,
  selectPrefsFor,
} from "@/features/sales/state/reportPrefsStore";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { formatDayRu } from "@/lib/period/format";
import { buildDealCrmUrl } from "@/lib/crm/dealUrl";
import { formatMoney } from "@/lib/format";

import {
  metricColumnSpan,
  metricSubHeadersForDisplay,
} from "./metricTableColumns";
import { ReportMetricCells } from "./ReportTableRow";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { TableSkeleton } from "./states/TableSkeleton";

const DEFAULT_PAGE_SIZE = 100;

export function DrillDownLevelTable() {
  const reportSlug = useDrilldownStore((s) => s.reportSlug);
  const stack = useDrilldownStore((s) => s.stack);
  const current = useDrilldownStore(selectCurrentEntry);

  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const teamIds = useFiltersStore((s) => s.teamIds);
  const dealScope = useReportPrefsStore((s) =>
    reportSlug ? selectPrefsFor(s, reportSlug).dealScope : "primary",
  );
  const showComparison = useReportPrefsStore(
    (s) => (reportSlug ? selectPrefsFor(s, reportSlug).comparisonDisplay : "full") === "full",
  );

  const showRootTabs =
    reportSlug === "by-managers" &&
    stack.length === 1 &&
    current?.level === "product-groups";

  const [rootTab, setRootTab] = useState<DrillDownRootTab>("products");
  const rootTabKey = useMemo(
    () =>
      showRootTabs && current
        ? `${current.rowKey.managerId ?? ""}|${current.label}`
        : "none",
    [showRootTabs, current],
  );
  const [trackedRootTabKey, setTrackedRootTabKey] =
    useState<string>(rootTabKey);
  if (trackedRootTabKey !== rootTabKey) {
    setTrackedRootTabKey(rootTabKey);
    setRootTab("products");
  }

  const effectiveLevel =
    showRootTabs && rootTab === "deals" ? "deals" : current?.level;

  // Local pagination state for the deals level. Reset whenever the
  // current entry changes — that's a fresh drill, so we restart from
  // offset 0. We use `limit` as the running cumulative page size so
  // the backend returns everything we want to render.
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const entryKey = useMemo(
    () =>
      current
        ? `${effectiveLevel}|${rootTab}|${current.metricId ?? ""}|${current.rowKey.managerId ?? ""}|${current.rowKey.productGroupId ?? ""}`
        : "none",
    [current, effectiveLevel, rootTab],
  );
  // Re-derive page size from the entry key without going through an
  // effect (cheap, deterministic, avoids a second render).
  const [trackedEntryKey, setTrackedEntryKey] = useState<string>(entryKey);
  if (trackedEntryKey !== entryKey) {
    setTrackedEntryKey(entryKey);
    setPageSize(DEFAULT_PAGE_SIZE);
  }

  const request: DrilldownRequest | null = useMemo(() => {
    if (!reportSlug || !current || !effectiveLevel) return null;
    const base: DrilldownRequest = {
      sectionSlug: "sales",
      reportSlug,
      rowKey: current.rowKey,
      level: effectiveLevel,
      period,
      comparisonPeriod,
      filters: { teamIds },
      metricId: current.metricId,
      dealScope,
    };
    if (effectiveLevel === "deals") {
      base.limit = pageSize;
      base.offset = 0;
    }
    return base;
  }, [
    reportSlug,
    current,
    effectiveLevel,
    period,
    comparisonPeriod,
    teamIds,
    dealScope,
    pageSize,
  ]);

  const { data, isLoading, error, refetch } = useDrilldownQuery(request);

  if (!current || !reportSlug) return null;

  let body: ReactNode;

  if (isLoading) {
    body = (
      <div className="min-h-0 flex-1 p-4">
        <TableSkeleton />
      </div>
    );
  } else if (error) {
    body = (
      <div className="min-h-0 flex-1 p-4">
        <ErrorState
          message={error.message}
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  } else if (!data) {
    body = (
      <div className="min-h-0 flex-1 p-4">
        <TableSkeleton />
      </div>
    );
  } else {
    body =
      data.level === "deals" ? (
        <DealsTable
          data={data}
          onLoadMore={() => setPageSize((n) => n + DEFAULT_PAGE_SIZE)}
        />
      ) : (
        <AggregateTable data={data} showComparison={showComparison} />
      );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showRootTabs ? (
        <DrillDownRootTabs value={rootTab} onChange={setRootTab} />
      ) : null}
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregate (product-groups / managers) table
// ---------------------------------------------------------------------------

type AggregateTableProps = {
  data: DrilldownAggregateResponse;
  showComparison: boolean;
};

function AggregateTable({ data, showComparison }: AggregateTableProps) {
  const reportSlug = useDrilldownStore((s) => s.reportSlug);
  const push = useDrilldownStore((s) => s.push);
  const currentEntry = useDrilldownStore(selectCurrentEntry);

  if (data.rows.length === 0) {
    return (
      <div className="min-h-0 flex-1 p-4">
        <EmptyState />
      </div>
    );
  }

  const handleRowClick = (row: DrilldownAggregateResponse["rows"][number]) => {
    if (!reportSlug || !currentEntry) return;
    if (data.level === "product-groups") {
      const groupId = row.dimension.product_group_id;
      const groupName = row.dimension.product_group_name;
      push({
        level: "deals",
        rowKey: {
          ...currentEntry.rowKey,
          productGroupId: typeof groupId === "number" ? groupId : undefined,
        },
        label: typeof groupName === "string" ? groupName : "Без товарной группы",
        metricId: currentEntry.metricId,
        metricLabel: currentEntry.metricLabel,
      });
      return;
    }
    if (data.level === "managers") {
      const managerId = row.dimension.manager_id;
      const managerName = row.dimension.manager_name;
      push({
        level: "deals",
        rowKey: {
          ...currentEntry.rowKey,
          managerId: typeof managerId === "number" ? managerId : undefined,
        },
        label: typeof managerName === "string" ? managerName : "—",
        metricId: currentEntry.metricId,
        metricLabel: currentEntry.metricLabel,
      });
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-left">
        <AggregateHeader columns={data.columns} showComparison={showComparison} />
        <tbody>
          {data.rows.map((row) => (
            <AggregateRow
              key={`drill-row-${row.key}`}
              row={row}
              dimensionColumns={data.columns.dimension}
              metricColumns={data.columns.metrics}
              showComparison={showComparison}
              onClick={() => handleRowClick(row)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AggregateHeaderProps = {
  columns: DrilldownAggregateResponse["columns"];
  showComparison: boolean;
};

function AggregateHeader({ columns, showComparison }: AggregateHeaderProps) {
  const subHeaders = metricSubHeadersForDisplay(showComparison);
  const colSpan = metricColumnSpan(showComparison);

  return (
    <thead className="sticky top-0 z-20 bg-table-header-bg">
      <tr>
        {columns.dimension.map((col, index) => (
          <th
            key={`drill-dim-${col.key}`}
            rowSpan={showComparison ? 2 : 1}
            scope="col"
            className={`whitespace-nowrap border-b border-r border-table-border px-3 py-2 text-left align-middle text-xs font-semibold text-text-primary ${
              index === 0
                ? "sticky left-0 z-30 bg-table-header-bg"
                : "bg-table-header-bg"
            }`}
          >
            {col.label}
          </th>
        ))}
        {columns.metrics.map((metric) => (
          <th
            key={`drill-metric-${metric.id}`}
            colSpan={colSpan}
            scope="colgroup"
            className="whitespace-nowrap border-b border-r border-table-border bg-table-header-bg px-3 py-2 text-center text-xs font-semibold text-text-primary"
          >
            {metric.label}
          </th>
        ))}
      </tr>
      {showComparison ? (
        <tr>
          {columns.metrics.flatMap((metric) =>
            subHeaders.map((sub, idx) => {
              const isLastSub = idx === subHeaders.length - 1;
              return (
                <th
                  key={`drill-sub-${metric.id}-${sub.kind}`}
                  scope="col"
                  className={`whitespace-nowrap border-b border-table-border bg-table-header-bg px-3 py-1.5 text-right align-middle text-[11px] font-medium text-text-secondary ${
                    isLastSub ? "border-r" : ""
                  }`}
                >
                  {sub.label}
                </th>
              );
            }),
          )}
        </tr>
      ) : null}
    </thead>
  );
}

type AggregateRowProps = {
  row: DrilldownAggregateResponse["rows"][number];
  dimensionColumns: DimensionColumn[];
  metricColumns: MetricColumn[];
  showComparison: boolean;
  onClick: () => void;
};

function AggregateRow({
  row,
  dimensionColumns,
  metricColumns,
  showComparison,
  onClick,
}: AggregateRowProps) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer bg-table-bg transition-colors hover:bg-table-row-hover"
    >
      {dimensionColumns.map((col, index) => {
        const value = row.dimension[col.key];
        const display =
          value === null || value === undefined ? "—" : String(value);
        const isFirst = index === 0;
        return (
          <td
            key={`drill-cell-${row.key}-${col.key}`}
            className={`whitespace-nowrap border-b border-r border-table-border px-3 py-2 text-sm text-text-primary ${
              isFirst
                ? "sticky left-0 z-10 bg-table-bg group-hover:bg-table-row-hover"
                : ""
            }`}
          >
            {display}
          </td>
        );
      })}
      {metricColumns.map((metric) => {
        const cell: MetricCell | undefined = row.metrics[metric.id];
        const current = cell?.current ?? null;
        const previous = cell?.previous ?? null;
        const delta = cell?.delta ?? null;
        const deltaPercent = cell?.deltaPercent ?? null;
        const comparisonCell = { current, previous, delta, deltaPercent };
        const color = getComparisonDeltaColor(metric, comparisonCell);
        const colorClass = deltaColorToClass(color);
        return (
          <ReportMetricCells
            key={`drill-mcell-${row.key}-${metric.id}`}
            metric={metric}
            current={current}
            previous={previous}
            delta={delta}
            deltaPercent={deltaPercent}
            colorClass={colorClass}
            color={color}
            showComparison={showComparison}
          />
        );
      })}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Deals table
// ---------------------------------------------------------------------------

type DealsTableProps = {
  data: DrilldownDealsResponse;
  onLoadMore: () => void;
};

function DealsTable({ data, onLoadMore }: DealsTableProps) {
  if (data.rows.length === 0) {
    return (
      <div className="min-h-0 flex-1 p-4">
        <EmptyState />
      </div>
    );
  }

  const shown = data.rows.length;
  const total = data.total;
  const canLoadMore = shown < total;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <DealsHeader />
          <tbody>
            {data.rows.map((deal) => (
              <DealRowCells key={`deal-${deal.dealId}`} deal={deal} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border-primary px-4 py-2 text-xs text-text-secondary">
        <span>
          Показано {shown} из {total}
        </span>
        {canLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-md bg-accent-primary px-3 py-1 text-xs text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            Загрузить ещё
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DealsHeader() {
  return (
    <thead className="sticky top-0 z-20 bg-table-header-bg">
      <tr>
        {(
          [
            "Сделка",
            "Сумма",
            "Создана",
            "Стадия",
            "Менеджер",
            "Товарная группа",
          ] as const
        ).map((label, idx) => (
          <th
            key={`deal-h-${idx}`}
            scope="col"
            className={`whitespace-nowrap border-b border-table-border bg-table-header-bg px-3 py-2 text-left text-xs font-semibold text-text-primary ${
              idx === 0 ? "sticky left-0 z-30" : ""
            }`}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

type DealRowCellsProps = {
  deal: DealRow;
};

function DealRowCells({ deal }: DealRowCellsProps) {
  const dealLabel = deal.dealName ?? `Сделка #${deal.dealId}`;

  return (
    <tr className="group bg-table-bg transition-colors hover:bg-table-row-hover">
      <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-table-border bg-table-bg px-3 py-2 text-sm text-text-primary group-hover:bg-table-row-hover">
        <a
          href={buildDealCrmUrl(deal.dealId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-primary hover:underline"
        >
          {dealLabel}
        </a>
        <span className="ml-1 text-xs text-text-muted">#{deal.dealId}</span>
      </td>
      <td className="whitespace-nowrap border-b border-table-border px-3 py-2 text-right text-sm tabular-nums text-text-primary">
        {formatMoney(deal.amount, { decimalPlaces: 0 })}
      </td>
      <td className="whitespace-nowrap border-b border-table-border px-3 py-2 text-sm text-text-secondary">
        {formatDateTimeRu(deal.createdAt)}
      </td>
      <td className="whitespace-nowrap border-b border-table-border px-3 py-2 text-sm text-text-secondary">
        {deal.stageName ?? deal.stageId}
      </td>
      <td className="whitespace-nowrap border-b border-table-border px-3 py-2 text-sm text-text-secondary">
        #{deal.managerId}
      </td>
      <td className="whitespace-nowrap border-b border-table-border px-3 py-2 text-sm text-text-secondary">
        {deal.productGroupName ?? "—"}
      </td>
    </tr>
  );
}

/**
 * Format a timestamptz string from Supabase as `dd.MM.yyyy`. The
 * deals table doesn't need second-level resolution — the day is
 * sufficient context next to the deal name + amount.
 */
function formatDateTimeRu(iso: string): string {
  // The string is `yyyy-MM-ddTHH:mm:ss...` — slice off the day part
  // and reuse the existing helper so locale handling stays
  // consistent with the rest of the app.
  const day = iso.slice(0, 10);
  try {
    return formatDayRu(day);
  } catch {
    return day;
  }
}
