import type { DealScope, Grouping, ReportSlug } from "@/features/reports/engine/types";
import type { ComparisonDisplay } from "@/features/sales/state/reportPrefsStore";

export function groupingLabel(grouping: Grouping): string {
  switch (grouping) {
    case "team":
      return "По отделам";
    case "total":
      return "Итого";
    default:
      return "Без группировки";
  }
}

export function dealScopeLabel(dealScope: DealScope): string {
  switch (dealScope) {
    case "repeat":
      return "Повторные";
    case "all":
      return "Все";
    default:
      return "Первичные";
  }
}

export function comparisonDisplayLabel(
  comparisonDisplay: ComparisonDisplay,
): string {
  return comparisonDisplay === "full" ? "С сравнением" : "Без сравнения";
}

export function teamIdsLabel(teamIds: readonly string[]): string {
  if (teamIds.length === 0) return "Все отделы";
  return `Отделы (${teamIds.length})`;
}

export function reportSlugLabel(reportSlug: ReportSlug): string {
  switch (reportSlug) {
    case "by-product-groups":
      return "По товарным группам";
    default:
      return "По менеджерам";
  }
}
