import type { DimensionColumn } from "@/features/reports/engine/types";
import type { Grouping } from "@/features/reports/engine/types";

import { metricColumnSpan } from "./metricTableColumns";

export function visibleDimensionColumns(
  dimensionColumns: DimensionColumn[],
  grouping: Grouping,
): DimensionColumn[] {
  if (grouping === "team") {
    return dimensionColumns.filter((col) => col.key !== "team_name");
  }
  return dimensionColumns;
}

export function tableColumnCount(
  dimensionColumns: DimensionColumn[],
  metricCount: number,
  showComparison: boolean,
): number {
  return (
    dimensionColumns.length + metricCount * metricColumnSpan(showComparison)
  );
}
