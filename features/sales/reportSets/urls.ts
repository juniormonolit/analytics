import type { ReportSlug } from "@/features/reports/engine/types";

const REPORT_BASE_PATH: Record<ReportSlug, string> = {
  "by-managers": "/sales/by-managers",
  "by-product-groups": "/sales/by-product-groups",
};

export function reportBasePath(reportSlug: ReportSlug): string {
  return REPORT_BASE_PATH[reportSlug];
}

export function buildSavedReportSetHref(
  reportSlug: ReportSlug,
  setId: string,
  currentSearchParams?: URLSearchParams,
): string {
  const params = new URLSearchParams(currentSearchParams?.toString() ?? "");
  params.set("set", setId);
  const query = params.toString();
  const base = reportBasePath(reportSlug);
  return query ? `${base}?${query}` : base;
}

export function isSavedReportSetHrefActive(
  pathname: string | null,
  setId: string,
  reportSlug: ReportSlug,
  activeSetId: string | null,
): boolean {
  if (!pathname || activeSetId !== setId) return false;
  return pathname === reportBasePath(reportSlug);
}
