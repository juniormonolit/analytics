"use client";

/**
 * Modal that lets the user pick + reorder which metrics appear in the
 * report table. Built on `@radix-ui/react-dialog` (overlay,
 * focus-trap, dismissal) + `@radix-ui/react-tabs` for the
 * "Показатели" / "Наборы" switch.
 */
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ReportSlug } from "@/features/reports/engine/types";
import type { ReportSetSnapshot } from "@/features/sales/reportSets/types";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";
import { useMetricColorSettingsStore } from "@/features/reports/metricColorSettings/metricColorSettingsStore";
import {
  useMetricsCatalog,
  type MetricCatalogRow,
} from "@/features/reports/useMetricsCatalog";
import {
  filterMetricsForReportUi,
  type MetricUiVisibilityMap,
} from "@/features/settings/metricUiVisibility";
import { useMetricUiVisibility } from "@/features/settings/hooks/useMetricUiVisibility";

import { MetricPickerList } from "./MetricPickerList";
import { MetricPickerPreview } from "./MetricPickerPreview";
import { MetricPickerSetsTab } from "./MetricPickerSetsTab";
import { MetricColorSettingsPanel } from "./MetricColorSettingsPanel";

type MetricPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportSlug: ReportSlug;
  selectedIds: string[];
  snapshot: Omit<ReportSetSnapshot, "metricIds" | "reportSlug" | "name">;
  onApply: (ids: string[]) => void;
  onApplySet: (setId: string) => void;
};

function resolveDraft(
  selectedIds: string[],
  metrics: MetricCatalogRow[],
  visibilityOverrides: MetricUiVisibilityMap,
): string[] {
  const visibleMetrics = filterMetricsForReportUi(metrics, visibilityOverrides);
  const ids: string[] = [];
  const known = new Set(visibleMetrics.map((m) => m.id));
  let allCoreInjected = false;

  for (const id of selectedIds) {
    if (id === "all_core") {
      if (!allCoreInjected) {
        for (const m of visibleMetrics) {
          if (m.is_core && !ids.includes(m.id)) ids.push(m.id);
        }
        allCoreInjected = true;
      }
      continue;
    }
    if (known.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function MetricPickerModal({
  open,
  onOpenChange,
  reportSlug,
  selectedIds,
  snapshot,
  onApply,
  onApplySet,
}: MetricPickerModalProps) {
  const hydrateSets = useReportSetsStore((state) => state.hydrate);
  const hydrateColorSettings = useMetricColorSettingsStore(
    (state) => state.hydrate,
  );

  useEffect(() => {
    if (open) {
      void hydrateSets();
      void hydrateColorSettings();
    }
  }, [hydrateColorSettings, hydrateSets, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex h-[640px] w-[min(960px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border-primary bg-modal-bg shadow-[var(--shadow-lg)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
            <Dialog.Title className="text-base font-semibold text-text-primary">
              Показатели отчета
            </Dialog.Title>
            <Dialog.Close
              aria-label="Закрыть"
              className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>

          {open ? (
            <MetricPickerBody
              reportSlug={reportSlug}
              committedIds={selectedIds}
              snapshot={snapshot}
              onApply={onApply}
              onApplySet={onApplySet}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type MetricPickerBodyProps = {
  reportSlug: ReportSlug;
  committedIds: string[];
  snapshot: Omit<ReportSetSnapshot, "metricIds" | "reportSlug" | "name">;
  onApply: (ids: string[]) => void;
  onApplySet: (setId: string) => void;
  onCancel: () => void;
};

function MetricPickerBody({
  reportSlug,
  committedIds,
  snapshot,
  onApply,
  onApplySet,
  onCancel,
}: MetricPickerBodyProps) {
  const catalog = useMetricsCatalog();
  const { overrides: visibilityOverrides } = useMetricUiVisibility();
  const metrics = useMemo(
    () =>
      filterMetricsForReportUi(catalog.data?.metrics ?? [], visibilityOverrides),
    [catalog.data, visibilityOverrides],
  );
  const metricsById = useMemo(
    () => new Map(metrics.map((m) => [m.id, m] as const)),
    [metrics],
  );

  const [draft, setDraft] = useState<string[]>(() =>
    resolveDraft(committedIds, metrics, visibilityOverrides),
  );

  const [seededFromMetrics, setSeededFromMetrics] = useState<
    MetricCatalogRow[] | null
  >(metrics.length > 0 ? metrics : null);
  if (metrics.length > 0 && seededFromMetrics === null) {
    setSeededFromMetrics(metrics);
    setDraft(resolveDraft(committedIds, metrics, visibilityOverrides));
  }

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [colorSettingsMetricId, setColorSettingsMetricId] = useState<
    string | null
  >(null);

  const colorSettingsMetric = colorSettingsMetricId
    ? metricsById.get(colorSettingsMetricId)
    : undefined;

  const saveSnapshot = useMemo<ReportSetSnapshot>(
    () => ({
      reportSlug,
      metricIds: draft,
      grouping: snapshot.grouping,
      dealScope: snapshot.dealScope,
      comparisonDisplay: snapshot.comparisonDisplay,
      teamIds: [...snapshot.teamIds],
      name: "",
    }),
    [draft, reportSlug, snapshot],
  );

  const handleToggle = (metricId: string) => {
    setDraft((prev) =>
      prev.includes(metricId)
        ? prev.filter((id) => id !== metricId)
        : [...prev, metricId],
    );
  };

  const handleRemove = (metricId: string) => {
    setDraft((prev) => prev.filter((id) => id !== metricId));
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Tabs.Root defaultValue="metrics" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label="Разделы выбора"
          className="flex items-center gap-2 border-b border-border-primary px-4"
        >
          <Tabs.Trigger
            value="metrics"
            className="border-b-2 border-transparent px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary data-[state=active]:border-accent-primary data-[state=active]:text-text-primary"
          >
            Показатели
          </Tabs.Trigger>
          <Tabs.Trigger
            value="sets"
            className="border-b-2 border-transparent px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary data-[state=active]:border-accent-primary data-[state=active]:text-text-primary"
          >
            Наборы
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content
          value="metrics"
          className="min-h-0 flex-1 overflow-hidden"
        >
          {catalog.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              Загрузка каталога…
            </div>
          ) : catalog.isError ? (
            <div className="flex h-full items-center justify-center text-sm text-danger">
              {catalog.error?.message ?? "Ошибка загрузки метрик"}
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-2 gap-4 px-4 py-4">
              <MetricPickerList
                metrics={metrics}
                selectedIds={draft}
                search={search}
                onSearchChange={setSearch}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                onToggle={handleToggle}
              />
              <MetricPickerPreview
                selectedIds={draft}
                metricsById={metricsById}
                onReorder={setDraft}
                onRemove={handleRemove}
                onOpenColorSettings={setColorSettingsMetricId}
              />
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content
          value="sets"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          <MetricPickerSetsTab
            reportSlug={reportSlug}
            snapshot={saveSnapshot}
            onApplySet={onApplySet}
          />
        </Tabs.Content>
      </Tabs.Root>

      <div className="flex items-center justify-end gap-2 border-t border-border-primary px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          className="rounded-md bg-accent-primary px-3 py-1.5 text-sm text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          Применить
        </button>
      </div>

      {colorSettingsMetric ? (
        <MetricColorSettingsPanel
          metric={colorSettingsMetric}
          onClose={() => setColorSettingsMetricId(null)}
        />
      ) : null}
    </div>
  );
}
