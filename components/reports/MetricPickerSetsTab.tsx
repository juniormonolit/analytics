"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ReportSlug } from "@/features/reports/engine/types";
import {
  comparisonDisplayLabel,
  dealScopeLabel,
  groupingLabel,
  reportSlugLabel,
  teamIdsLabel,
} from "@/features/sales/reportSets/labels";
import type { ReportSetSnapshot } from "@/features/sales/reportSets/types";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";

type MetricPickerSetsTabProps = {
  reportSlug: ReportSlug;
  snapshot: ReportSetSnapshot;
  onApplySet: (setId: string) => void;
};

function metricCountLabel(metricIds: string[]): string {
  if (metricIds.includes("all_core")) return "Все базовые метрики";
  return `${metricIds.length} метрик`;
}

function SetMeta({ snapshot }: { snapshot: ReportSetSnapshot }) {
  return (
    <p className="mt-1 text-xs text-text-muted">
      {metricCountLabel(snapshot.metricIds)} · {dealScopeLabel(snapshot.dealScope)} ·{" "}
      {groupingLabel(snapshot.grouping)} ·{" "}
      {comparisonDisplayLabel(snapshot.comparisonDisplay)} ·{" "}
      {teamIdsLabel(snapshot.teamIds)}
    </p>
  );
}

export function MetricPickerSetsTab({
  reportSlug,
  snapshot,
  onApplySet,
}: MetricPickerSetsTabProps) {
  const allSets = useReportSetsStore((state) => state.sets);
  const saveSet = useReportSetsStore((state) => state.saveSet);
  const deleteSet = useReportSetsStore((state) => state.deleteSet);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sortedSets = useMemo(
    () =>
      allSets
        .filter((item) => item.reportSlug === reportSlug)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [allSets, reportSlug],
  );

  const otherSets = useMemo(
    () =>
      allSets
        .filter((item) => item.reportSlug !== reportSlug)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [allSets, reportSlug],
  );

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите название набора");
      return;
    }
    saveSet({ ...snapshot, name: trimmed });
    setName("");
    setError(null);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <section className="rounded-md border border-border-primary bg-bg-card p-4">
        <h3 className="text-sm font-medium text-text-primary">
          Сохранить текущий отчёт
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Сохраняются метрики, переключатели и выбранные отделы.
        </p>
        <SetMeta snapshot={snapshot} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Название набора"
            className="min-w-0 flex-1 rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary"
          />
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-accent-primary px-3 py-2 text-sm text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            Сохранить
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-danger">{error}</p>
        ) : null}
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto">
        <h3 className="mb-2 text-sm font-medium text-text-primary">
          Наборы для «{reportSlugLabel(reportSlug)}»
        </h3>
        {sortedSets.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-primary bg-bg-card p-4 text-sm text-text-muted">
            Пока нет сохранённых наборов для этого отчёта.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedSets.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border-primary bg-bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 shrink-0 text-accent-primary" />
                    <span className="truncate text-sm font-medium text-text-primary">
                      {item.name}
                    </span>
                  </div>
                  <SetMeta snapshot={item} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApplySet(item.id)}
                    className="rounded-md border border-border-primary px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-card-hover"
                  >
                    Применить
                  </button>
                  <button
                    type="button"
                    aria-label={`Удалить набор ${item.name}`}
                    onClick={() => deleteSet(item.id)}
                    className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {otherSets.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-text-primary">
              Другие сохранённые отчёты
            </h3>
            <ul className="flex flex-col gap-2">
              {otherSets.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border-primary bg-bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="truncate text-sm font-medium text-text-primary">
                        {item.name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {reportSlugLabel(item.reportSlug)} ·{" "}
                      {metricCountLabel(item.metricIds)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplySet(item.id)}
                    className="shrink-0 rounded-md border border-border-primary px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-card-hover"
                  >
                    Открыть
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
