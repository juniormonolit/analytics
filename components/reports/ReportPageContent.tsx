"use client";

/**
 * Thin client-side composition of `ReportToolbar` + `ReportTable`.
 */
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ReportSlug } from "@/features/reports/engine/types";
import {
  selectPrefsFor,
  useReportPrefsStore,
} from "@/features/sales/state/reportPrefsStore";
import {
  applySavedReportSet,
  useReportSetsStore,
} from "@/features/sales/state/reportSetsStore";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { buildSavedReportSetHref } from "@/features/sales/reportSets/urls";

import { ReportTable } from "./ReportTable";
import { ReportToolbar } from "./ReportToolbar";

type ReportPageContentProps = {
  reportSlug: ReportSlug;
};

export function ReportPageContent({ reportSlug }: ReportPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setId = searchParams.get("set");

  useEffect(() => {
    async function hydrateAndApplySet() {
      const prefsStore = useReportPrefsStore.getState();
      const setsStore = useReportSetsStore.getState();

      await prefsStore.hydrate(reportSlug);
      await setsStore.hydrate();

      if (!setId) return;

      const savedSet = setsStore.getSetById(setId);
      if (!savedSet) return;

      if (savedSet.reportSlug !== reportSlug) {
        router.replace(buildSavedReportSetHref(savedSet.reportSlug, setId));
        return;
      }

      const current = selectPrefsFor(prefsStore, reportSlug);
      const applied = applySavedReportSet(savedSet);
      prefsStore.replaceForReport(reportSlug, {
        ...current,
        metricIds: applied.metricIds,
        grouping: applied.grouping,
        dealScope: applied.dealScope,
        comparisonDisplay: applied.comparisonDisplay,
      });
      useFiltersStore.getState().setTeamIds(applied.teamIds);
    }

    void hydrateAndApplySet();
  }, [reportSlug, router, setId]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ReportToolbar reportSlug={reportSlug} />
      <div className="min-h-0 flex-1">
        <ReportTable reportSlug={reportSlug} />
      </div>
    </div>
  );
}
