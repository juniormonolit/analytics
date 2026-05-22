/**
 * Pure helpers for the report table sorting logic.
 *
 * Column ids encode where the value comes from so a single sort
 * descriptor can address either a dimension cell or any of the four
 * sub-columns inside a metric group.
 */
import type {
  MetricCell,
  Row,
  Grouping,
} from "@/features/reports/engine/types";
import type { SortDescriptor } from "@/features/sales/state/reportPrefsStore";

export type DimensionColumnId = `dimension:${string}`;
export type MetricSubKind = "current" | "previous" | "delta" | "deltaPercent";
export type MetricColumnId = `metric:${string}.${MetricSubKind}`;
export type SortColumnId = DimensionColumnId | MetricColumnId;

export function dimensionColumnId(key: string): DimensionColumnId {
  return `dimension:${key}`;
}

export function metricColumnId(
  metricId: string,
  sub: MetricSubKind,
): MetricColumnId {
  return `metric:${metricId}.${sub}`;
}

/**
 * Extract the comparable value addressed by a column id from a row.
 * Returns `null` for missing/non-finite numeric cells so the
 * comparator can place them consistently.
 */
export function extractSortValue(
  row: Row,
  columnId: string,
): number | string | null {
  if (columnId.startsWith("dimension:")) {
    const key = columnId.slice("dimension:".length);
    const value = row.dimension[key];
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    return String(value);
  }
  if (columnId.startsWith("metric:")) {
    const rest = columnId.slice("metric:".length);
    const dotIndex = rest.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const metricId = rest.slice(0, dotIndex);
    const sub = rest.slice(dotIndex + 1) as MetricSubKind;
    const cell: MetricCell | undefined = row.metrics[metricId];
    if (!cell) return null;
    const value = cell[sub];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  return null;
}

/**
 * Compare two arbitrary cell values consistently. `null` always sorts
 * after non-null regardless of direction, so empty rows fall to the
 * bottom of both ascending and descending sorts.
 */
function compareValues(
  a: number | string | null,
  b: number | string | null,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ru");
}

/**
 * Return a copy of `rows` sorted by `descriptor`. When the descriptor
 * is `null` the original order is preserved (engine order — which
 * matches dimension order from Supabase).
 */
export function sortRows(
  rows: readonly Row[],
  descriptor: SortDescriptor | null,
): Row[] {
  if (!descriptor) return [...rows];
  const sorted = [...rows];
  const sign = descriptor.direction === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    const va = extractSortValue(a, descriptor.columnId);
    const vb = extractSortValue(b, descriptor.columnId);
    return sign * compareValues(va, vb);
  });
  return sorted;
}

/**
 * Split team-grouped rows into contiguous blocks:
 * `[label, ...members, subtotal]`.
 */
export function splitTeamGroupBlocks(rows: readonly Row[]): Row[][] {
  const blocks: Row[][] = [];
  let current: Row[] = [];

  for (const row of rows) {
    if (row.rowKind === "groupLabel") {
      if (current.length > 0) blocks.push(current);
      current = [row];
      continue;
    }
    current.push(row);
  }
  if (current.length > 0) blocks.push(current);

  return blocks;
}

/**
 * Sort rows while preserving team-group structure:
 * groups reorder by their subtotal row; members sort inside the group.
 */
export function sortTeamGroupedRows(
  rows: readonly Row[],
  descriptor: SortDescriptor | null,
): Row[] {
  if (!descriptor) return [...rows];

  const blocks = splitTeamGroupBlocks(rows);
  const sign = descriptor.direction === "asc" ? 1 : -1;

  const sortedBlocks = blocks.map((block) => {
    if (block.length <= 2) return block;
    const label = block[0];
    const subtotal = block[block.length - 1];
    const members = block.slice(1, -1);
    const sortedMembers = sortRows(members, descriptor);
    return [label, ...sortedMembers, subtotal];
  });

  sortedBlocks.sort((a, b) => {
    const subtotalA = a[a.length - 1];
    const subtotalB = b[b.length - 1];
    const va = extractSortValue(subtotalA, descriptor.columnId);
    const vb = extractSortValue(subtotalB, descriptor.columnId);
    return sign * compareValues(va, vb);
  });

  return sortedBlocks.flat();
}

export function sortRowsForGrouping(
  rows: readonly Row[],
  descriptor: SortDescriptor | null,
  grouping: Grouping,
): Row[] {
  if (grouping === "team") {
    return sortTeamGroupedRows(rows, descriptor);
  }
  return sortRows(rows, descriptor);
}

/**
 * Toggle helper — feeds the prefs store. If the click is on the
 * already-active column, flip the direction; otherwise start in
 * descending order (sensible default for numeric metric columns).
 */
export function toggleSort(
  current: SortDescriptor | null,
  columnId: string,
): SortDescriptor {
  if (!current || current.columnId !== columnId) {
    return { columnId, direction: "desc" };
  }
  return {
    columnId,
    direction: current.direction === "desc" ? "asc" : "desc",
  };
}
