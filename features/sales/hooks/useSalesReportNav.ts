"use client";

import { useMemo } from "react";

import type { ReportSlug } from "@/features/reports/engine/types";
import { buildSavedReportSetHref } from "@/features/sales/reportSets/urls";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";
import { SALES_REPORTS } from "@/lib/navigation/sections";

export type SalesNavItem = {
  slug: string;
  label: string;
  href: string;
  kind: "system" | "saved";
  reportSlug: ReportSlug;
  setId?: string;
};

export function useSalesReportNavItems(): SalesNavItem[] {
  const sets = useReportSetsStore((state) => state.sets);

  return useMemo(() => {
    const systemItems: SalesNavItem[] = SALES_REPORTS.map((report) => ({
      slug: report.slug,
      label: report.label,
      href: report.href,
      kind: "system",
      reportSlug: report.slug as ReportSlug,
    }));

    const savedItems: SalesNavItem[] = [...sets]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((set) => ({
        slug: `set-${set.id}`,
        label: set.name,
        href: buildSavedReportSetHref(set.reportSlug, set.id),
        kind: "saved",
        reportSlug: set.reportSlug,
        setId: set.id,
      }));

    return [...systemItems, ...savedItems];
  }, [sets]);
}
