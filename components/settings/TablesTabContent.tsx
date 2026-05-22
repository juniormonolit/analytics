"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ErrorState } from "@/components/reports/states/ErrorState";
import { TableSkeleton } from "@/components/reports/states/TableSkeleton";
import { getSaDebugTableMeta, isSaDebugTableName } from "@/lib/debug/saTables";
import { useDebugTablePreview } from "@/features/settings/hooks/useDebugTablePreview";
import { useDebugTables } from "@/features/settings/hooks/useDebugTables";

const LIMIT_OPTIONS = [50, 100, 200] as const;
const ROW_SEARCH_DEBOUNCE_MS = 300;

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TablesTabContent() {
  const searchParams = useSearchParams();
  const initialTable = searchParams.get("table");

  const { data: tablesData, isLoading, error, refetch } = useDebugTables();
  const [selectedTable, setSelectedTable] = useState<string>(
    initialTable && isSaDebugTableName(initialTable) ? initialTable : "daily_sales",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [debouncedRowSearch, setDebouncedRowSearch] = useState("");
  const [limit, setLimit] = useState<(typeof LIMIT_OPTIONS)[number]>(50);
  const [offset, setOffset] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const tableMeta = isSaDebugTableName(selectedTable)
    ? getSaDebugTableMeta(selectedTable)
    : null;
  const activeSortColumn = sortColumn ?? tableMeta?.defaultSortColumn ?? "id";
  const sortParam = `${activeSortColumn}.${sortAsc ? "asc" : "desc"}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedRowSearch(rowSearch);
    }, ROW_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [rowSearch]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedRowSearch]);

  const {
    data: previewData,
    isLoading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = useDebugTablePreview({
    table: selectedTable,
    limit,
    offset,
    sort: sortParam,
    search: debouncedRowSearch,
    enabled: isSaDebugTableName(selectedTable),
  });

  const filteredTables = useMemo(() => {
    const tables = tablesData?.tables ?? [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => t.tableName.toLowerCase().includes(q));
  }, [tablesData?.tables, tableSearch]);

  const previewRows = previewData?.rows ?? [];

  const previewColumns = useMemo(() => {
    if (previewData?.columns?.length) {
      return previewData.columns;
    }
    return tableMeta?.columns.map((column) => ({
      name: column.name,
      dataType: column.dataType,
    })) ?? [];
  }, [previewData?.columns, tableMeta?.columns]);

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setOffset(0);
    setSortColumn(null);
    setSortAsc(false);
    setRowSearch("");
    setDebouncedRowSearch("");
  };

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortAsc((prev) => !prev);
      return;
    }
    setSortColumn(columnName);
    setSortAsc(false);
  };

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

  return (
    <div className="flex h-full min-h-[640px] gap-4">
      <aside className="flex w-64 shrink-0 flex-col rounded-md border border-border-primary bg-bg-card">
        <div className="border-b border-border-primary p-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Поиск таблицы
            <input
              type="search"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="daily_sales..."
              className="rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {filteredTables.map((table) => {
            const active = table.tableName === selectedTable;
            return (
              <li key={table.tableName}>
                <button
                  type="button"
                  onClick={() => handleSelectTable(table.tableName)}
                  className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-accent-soft text-accent-primary"
                      : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                  }`}
                >
                  <div className="font-medium">{table.tableName}</div>
                  <div className="text-xs text-text-muted">
                    {table.rowEstimate == null
                      ? "строк: ?"
                      : `строк: ${table.rowEstimate}`}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-md border border-border-primary bg-bg-card">
        <header className="border-b border-border-primary px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">
            sa.{selectedTable}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Read-only preview. Схема: {tablesData?.schema ?? "sa"}
          </p>
        </header>

        <div className="border-b border-border-primary px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Колонки
          </p>
          <div className="flex flex-wrap gap-2">
            {previewColumns.map((column) => (
              <span
                key={column.name}
                className="rounded-full border border-border-primary px-2 py-0.5 text-xs text-text-secondary"
                title={column.dataType ?? "unknown"}
              >
                {column.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border-primary px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Limit
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) as (typeof LIMIT_OPTIONS)[number]);
                setOffset(0);
              }}
              className="rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              className="rounded-md border border-border-primary px-2 py-1 text-sm text-text-secondary disabled:opacity-50"
            >
              Назад
            </button>
            <span className="text-xs text-text-muted">
              offset {offset}
              {debouncedRowSearch.trim()
                ? ` · поиск: «${debouncedRowSearch.trim()}»`
                : ""}
            </span>
            <button
              type="button"
              disabled={(previewData?.rows.length ?? 0) < limit}
              onClick={() => setOffset((prev) => prev + limit)}
              className="rounded-md border border-border-primary px-2 py-1 text-sm text-text-secondary disabled:opacity-50"
            >
              Далее
            </button>
          </div>
          <label className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 text-sm text-text-secondary">
            Поиск по строкам
            <input
              type="search"
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder="по всей таблице"
              className="w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {previewLoading ? <TableSkeleton /> : null}
          {previewError ? (
            <ErrorState
              message={previewError.message}
              onRetry={() => {
                void refetchPreview();
              }}
            />
          ) : null}
          {!previewLoading && !previewError ? (
            <div className="overflow-auto rounded-md border border-table-border">
              <table className="w-full min-w-max border-collapse text-left text-sm">
                <thead className="bg-table-header-bg">
                  <tr>
                    {previewColumns.map((column) => (
                      <th
                        key={column.name}
                        className="border-b border-table-border px-3 py-2 font-medium text-text-primary"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(column.name)}
                          className="hover:text-accent-primary"
                        >
                          {column.name}
                          {activeSortColumn === column.name
                            ? sortAsc
                              ? " ↑"
                              : " ↓"
                            : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-table-border hover:bg-bg-card-hover"
                    >
                      {previewColumns.map((column) => (
                        <td
                          key={column.name}
                          className="max-w-[280px] truncate px-3 py-2 text-text-secondary"
                          title={formatCell(row[column.name])}
                        >
                          {formatCell(row[column.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length === 0 ? (
                <p className="p-4 text-sm text-text-secondary">Нет строк</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
