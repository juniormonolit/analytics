"use client";

/**
 * Left column of the MetricPickerModal: searchable + category-filtered
 * list of catalog metrics with checkboxes that toggle membership in
 * the draft selection.
 */
import { Check, Search } from "lucide-react";
import { useMemo } from "react";

import type { MetricCatalogRow } from "@/features/reports/useMetricsCatalog";
import { stripDealScopeSuffix } from "@/features/reports/engine/dealScope";

type MetricPickerListProps = {
  metrics: MetricCatalogRow[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onToggle: (metricId: string) => void;
};

function uniqueCategories(metrics: MetricCatalogRow[]): string[] {
  const seen = new Set<string>();
  for (const m of metrics) {
    if (m.category) seen.add(m.category);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, "ru"));
}

function metricMatchesSearch(
  metric: MetricCatalogRow,
  needle: string,
): boolean {
  if (!needle) return true;
  const haystack = [
    metric.name_ru,
    metric.name_short_ru ?? "",
    metric.id,
    metric.category ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export function MetricPickerList({
  metrics,
  selectedIds,
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onToggle,
}: MetricPickerListProps) {
  const categories = useMemo(() => uniqueCategories(metrics), [metrics]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      if (activeCategory && m.category !== activeCategory) return false;
      if (!metricMatchesSearch(m, search)) return false;
      return true;
    });
  }, [metrics, search, activeCategory]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Поиск по названию или категории"
          className="w-full rounded-md border border-input-border bg-input-bg py-1.5 pl-8 pr-3 text-sm text-input-text placeholder:text-input-placeholder focus:border-input-border-focus focus:outline-none"
        />
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              activeCategory === null
                ? "bg-accent-primary text-text-on-accent"
                : "border border-border-primary bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            Все
          </button>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={`cat-${cat}`}
                type="button"
                onClick={() => onCategoryChange(isActive ? null : cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-accent-primary text-text-on-accent"
                    : "border border-border-primary bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-primary">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-text-muted">
            Метрики не найдены
          </div>
        ) : (
          <ul className="divide-y divide-border-primary">
            {filtered.map((metric) => {
              const isSelected = selectedSet.has(metric.id);
              return (
                <li key={metric.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(metric.id)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-card-hover"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-accent-primary bg-accent-primary text-text-on-accent"
                          : "border-input-border bg-input-bg"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-3 w-3" aria-hidden />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm text-text-primary">
                        {stripDealScopeSuffix(metric.name_ru)}
                      </span>
                      {metric.category || metric.data_type ? (
                        <span className="text-xs text-text-muted">
                          {[metric.category, metric.data_type]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
