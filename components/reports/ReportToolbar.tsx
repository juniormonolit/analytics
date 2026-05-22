"use client";

/**
 * Toolbar above the report table.
 */
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  useReportPrefsStore,
  selectPrefsFor,
} from "@/features/sales/state/reportPrefsStore";
import { applySavedReportSet, useReportSetsStore } from "@/features/sales/state/reportSetsStore";
import { buildSavedReportSetHref } from "@/features/sales/reportSets/urls";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { hiddenMetricIdsForReportUi } from "@/features/settings/metricUiVisibility";
import { useMetricUiVisibility } from "@/features/settings/hooks/useMetricUiVisibility";
import { useMetricsCatalog } from "@/features/reports/useMetricsCatalog";
import { reportQueryKey } from "@/features/reports/useReportQuery";

import { ComparisonDisplaySwitch } from "./ComparisonDisplaySwitch";
import { GroupingSwitch } from "./GroupingSwitch";
import { DealScopeSwitch } from "./DealScopeSwitch";
import { MetricPickerModal } from "./MetricPickerModal";
import {
  TOOLBAR_ACTION_BUTTON,
  TOOLBAR_ICON_BUTTON,
} from "./toolbarStyles";
import type { ReportSlug } from "@/features/reports/engine/types";

type ReportToolbarProps = {
  reportSlug: ReportSlug;
};

export function ReportToolbar({ reportSlug }: ReportToolbarProps) {
  const router = useRouter();
  const prefs = useReportPrefsStore((s) => selectPrefsFor(s, reportSlug));
  const setMetricIds = useReportPrefsStore((s) => s.setMetricIds);
  const getSetById = useReportSetsStore((s) => s.getSetById);
  const replaceForReport = useReportPrefsStore((s) => s.replaceForReport);
  const setTeamIds = useFiltersStore((s) => s.setTeamIds);
  const searchParams = useSearchParams();
  const { overrides: visibilityOverrides } = useMetricUiVisibility();
  const { data: metricsCatalog } = useMetricsCatalog();

  const uiHiddenMetricIds = useMemo(
    () =>
      hiddenMetricIdsForReportUi(
        metricsCatalog?.metrics ?? [],
        visibilityOverrides,
      ),
    [metricsCatalog?.metrics, visibilityOverrides],
  );

  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const teamIds = useFiltersStore((s) => s.teamIds);

  const queryClient = useQueryClient();

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleRefresh = () => {
    const key = reportQueryKey({
      sectionSlug: "sales",
      reportSlug,
      period,
      comparisonPeriod,
      filters: { teamIds },
      metricIds: prefs.metricIds,
      grouping: prefs.grouping,
      dealScope: prefs.dealScope,
      uiHiddenMetricIds,
    });
    void queryClient.invalidateQueries({ queryKey: [...key] });
  };

  const applySavedSet = (setId: string) => {
    const savedSet = getSetById(setId);
    if (!savedSet) return;

    if (savedSet.reportSlug === reportSlug) {
      const applied = applySavedReportSet(savedSet);
      replaceForReport(reportSlug, {
        ...prefs,
        metricIds: applied.metricIds,
        grouping: applied.grouping,
        dealScope: applied.dealScope,
        comparisonDisplay: applied.comparisonDisplay,
      });
      setTeamIds(applied.teamIds);
      router.replace(buildSavedReportSetHref(reportSlug, setId, searchParams));
      setIsPickerOpen(false);
      return;
    }

    router.push(
      buildSavedReportSetHref(savedSet.reportSlug, setId, searchParams),
    );
    setIsPickerOpen(false);
  };

  const metricButtonLabel =
    prefs.metricIds.length === 0
      ? "Метрики"
      : prefs.metricIds.includes("all_core")
        ? "Метрики (все базовые)"
        : `Метрики (${prefs.metricIds.length})`;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border-primary bg-bg-card px-3 py-2">
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className={TOOLBAR_ACTION_BUTTON}
        >
          <SlidersHorizontal
            className="h-4 w-4 text-text-secondary"
            aria-hidden
          />
          <span>{metricButtonLabel}</span>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        <DealScopeSwitch reportSlug={reportSlug} />
        <ComparisonDisplaySwitch reportSlug={reportSlug} />
        <GroupingSwitch reportSlug={reportSlug} />
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Обновить отчет"
          title="Обновить"
          className={TOOLBAR_ICON_BUTTON}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <MetricPickerModal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        reportSlug={reportSlug}
        selectedIds={prefs.metricIds}
        snapshot={{
          grouping: prefs.grouping,
          dealScope: prefs.dealScope,
          comparisonDisplay: prefs.comparisonDisplay,
          teamIds,
        }}
        onApply={(ids) => {
          setMetricIds(reportSlug, ids);
          setIsPickerOpen(false);
        }}
        onApplySet={applySavedSet}
      />
    </div>
  );
}
