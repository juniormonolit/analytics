"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/reports/states/ErrorState";
import { TableSkeleton } from "@/components/reports/states/TableSkeleton";
import type { DebugMetricRow } from "@/lib/debug/metricExplanation";
import {
  explainMetricEngine,
  metricCatalogDescription,
} from "@/lib/debug/metricExplanation";
import { useDebugMetrics } from "@/features/settings/hooks/useDebugMetrics";
import { useMetricVerification } from "@/features/settings/hooks/useMetricVerification";
import { useMetricUiVisibility } from "@/features/settings/hooks/useMetricUiVisibility";

type MetricDetailPanelProps = {
  metric: DebugMetricRow | null;
  onClose: () => void;
  onOpenMetric: (metricId: string) => void;
};

function MetricDetailPanel({
  metric,
  onClose,
  onOpenMetric,
}: MetricDetailPanelProps) {
  if (!metric) return null;

  const explanation = explainMetricEngine(metric);
  const relatedTable = explanation.relatedTable;

  return (
    <Dialog.Root open={metric != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[720px] flex-col border-l border-border-primary bg-modal-bg shadow-[var(--shadow-lg)] outline-none">
          <header className="flex items-start justify-between gap-2 border-b border-border-primary px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold text-text-primary">
                {metric.name_ru}
              </Dialog.Title>
              <p className="mt-1 font-mono text-xs text-text-secondary">{metric.id}</p>
            </div>
            <Dialog.Close
              aria-label="Закрыть"
              className="rounded p-1 text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">
                Описание из каталога
              </h3>
              <p className="text-sm text-text-secondary">
                {metricCatalogDescription(metric)}
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">
                Как движок сейчас считает
              </h3>
              <p className="text-sm text-text-secondary">{explanation.summary}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-text-muted">type</dt>
                  <dd className="text-text-primary">{metric.metric_type}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">aggregation</dt>
                  <dd className="text-text-primary">{metric.aggregation_fn ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">source</dt>
                  <dd className="text-text-primary">{metric.source ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">source_column</dt>
                  <dd className="text-text-primary">{metric.source_column ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">active (каталог)</dt>
                  <dd className="text-text-primary">
                    {metric.is_active ? "yes" : "no"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">
                SQL-пояснение (не исполняется)
              </h3>
              <pre className="overflow-x-auto rounded-md border border-border-primary bg-bg-primary p-3 text-xs text-text-secondary">
                {explanation.sqlExplanation}
              </pre>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">
                Где смотреть данные
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedTable ? (
                  <Link
                    href={`/settings/tables?table=${relatedTable}`}
                    className="rounded-md border border-border-primary px-3 py-1.5 text-sm text-accent-primary hover:bg-accent-soft"
                  >
                    Открыть sa.{relatedTable}
                  </Link>
                ) : (
                  <span className="text-sm text-text-secondary">Таблица не определена</span>
                )}
              </div>
              {metric.dependencies && metric.dependencies.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-text-muted">Зависимости</p>
                  <div className="flex flex-wrap gap-2">
                    {metric.dependencies.map((depId) => (
                      <button
                        key={depId}
                        type="button"
                        onClick={() => onOpenMetric(depId)}
                        className="rounded-md border border-border-primary px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover"
                      >
                        {depId}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MetricsTabContent() {
  const { data, isLoading, error, refetch } = useDebugMetrics();
  const { isVerified, setVerified } = useMetricVerification();
  const {
    isVisible: isVisibleInReports,
    setVisible: setVisibleInReports,
    isAlwaysHidden,
  } = useMetricUiVisibility();
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const metricsById = useMemo(() => {
    const map = new Map<string, DebugMetricRow>();
    for (const metric of data?.metrics ?? []) {
      map.set(metric.id, metric);
    }
    return map;
  }, [data?.metrics]);

  const filteredMetrics = useMemo(() => {
    const metrics = data?.metrics ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return metrics;
    return metrics.filter(
      (metric) =>
        metric.id.toLowerCase().includes(q) ||
        metric.name_ru.toLowerCase().includes(q) ||
        (metric.source ?? "").toLowerCase().includes(q),
    );
  }, [data?.metrics, search]);

  const selectedMetric = selectedMetricId
    ? (metricsById.get(selectedMetricId) ?? null)
    : null;

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
    <>
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по id, названию, source..."
          className="w-full max-w-md rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <div className="overflow-auto rounded-md border border-table-border bg-table-bg">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-table-header-bg">
            <tr>
              {[
                "id",
                "название",
                "тип",
                "data_type",
                "aggregation",
                "source",
                "source_column",
                "dependencies",
                "formula",
                "active",
                "core",
                "В отчётах",
                "Считается верно",
              ].map((header) => (
                <th
                  key={header}
                  className="border-b border-table-border px-3 py-2 font-medium text-text-primary"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((metric) => {
              const verified = isVerified(metric.id);
              const visibleInReports = isVisibleInReports(metric.id);
              const lockedHidden = isAlwaysHidden(metric.id);
              return (
                <tr
                  key={metric.id}
                  className={`cursor-pointer border-b border-table-border hover:bg-bg-card-hover ${
                    verified ? "bg-success-bg" : ""
                  }`}
                  onClick={() => setSelectedMetricId(metric.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-text-primary">
                    {metric.id}
                  </td>
                  <td className="px-3 py-2 text-text-primary">{metric.name_ru}</td>
                  <td className="px-3 py-2 text-text-secondary">{metric.metric_type}</td>
                  <td className="px-3 py-2 text-text-secondary">{metric.data_type}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {metric.aggregation_fn ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {metric.source ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {metric.source_column ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-text-secondary">
                    {metric.dependencies?.join(", ") ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-text-secondary">
                    {metric.formula ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {metric.is_active ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {metric.is_core ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2">
                    <label
                      className="inline-flex items-center gap-2 text-xs text-text-secondary"
                      onClick={(e) => e.stopPropagation()}
                      title={
                        lockedHidden
                          ? "Скрыта автоматически (дублирует переключатель Первичные/Повторные)"
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={visibleInReports}
                        disabled={lockedHidden}
                        onChange={(e) =>
                          setVisibleInReports(metric.id, e.target.checked)
                        }
                        aria-label={`Показывать в отчётах: ${metric.name_ru}`}
                      />
                      {lockedHidden ? "авто" : visibleInReports ? "да" : "нет"}
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <label
                      className="inline-flex items-center gap-2 text-xs text-text-secondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={verified}
                        onChange={(e) =>
                          setVerified(metric.id, e.target.checked)
                        }
                        aria-label={`Считается верно: ${metric.name_ru}`}
                      />
                      {verified ? "да" : "нет"}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MetricDetailPanel
        metric={selectedMetric}
        onClose={() => setSelectedMetricId(null)}
        onOpenMetric={setSelectedMetricId}
      />
    </>
  );
}
