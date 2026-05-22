import type { ComparisonDisplay } from "@/features/sales/state/reportPrefsStore";
import type { DealScope, Grouping, ReportSlug } from "@/features/reports/engine/types";
import type { DepartmentId } from "@/lib/org/departmentId";

/** Saved report preset: metrics + toolbar toggles for a base report. */
export type SavedReportSet = {
  id: string;
  name: string;
  reportSlug: ReportSlug;
  metricIds: string[];
  grouping: Grouping;
  dealScope: DealScope;
  comparisonDisplay: ComparisonDisplay;
  /** Selected org departments (empty = all within sales scope). */
  teamIds: DepartmentId[];
  createdAt: string;
  updatedAt: string;
};

export type SavedReportSetInput = Omit<
  SavedReportSet,
  "id" | "createdAt" | "updatedAt"
>;

export type ReportSetSnapshot = SavedReportSetInput;
