/**
 * Apply the requested `grouping` to a list of merged rows and produce
 * the final `Row[]` that goes back to the client.
 *
 * - `none`  — return rows as-is, one per dimension key.
 * - `team`  — bucket rows by `team_id`, emit a label row, member rows,
 *             then a subtotal row per team (CR recomputed from sums).
 * - `total` — collapse everything into a single grand-totals row.
 */
import { buildMetricCells } from "./aggregate";
import type { MetricRow } from "./metricsCatalog";
import { aggregateMergedRows } from "./totals";
import type { Grouping, MergedRow, Row } from "./types";

const TOTALS_KEY = "__totals__";

/**
 * Convert a single `MergedRow` into the public `Row` shape — used by
 * `grouping === "none"` and to render leaf rows under team groups.
 */
export function mergedRowToOutput(merged: MergedRow, metrics: MetricRow[]): Row {
  return {
    key: merged.key,
    rowKind: "data",
    dimension: { ...merged.dimension },
    metrics: buildMetricCells(
      metrics,
      merged.currentRaw,
      merged.previousRaw,
      merged.currentCount,
      merged.previousCount,
    ),
  };
}

export type GroupingResult = {
  rows: Row[];
};

export function applyGrouping(
  rows: MergedRow[],
  grouping: Grouping,
  metrics: MetricRow[],
): GroupingResult {
  if (grouping === "none") {
    return { rows: rows.map((r) => mergedRowToOutput(r, metrics)) };
  }

  if (grouping === "total") {
    const agg = aggregateMergedRows(rows);
    const totalsRow: Row = {
      key: TOTALS_KEY,
      rowKind: "grandTotal",
      dimension: {},
      metrics: buildMetricCells(
        metrics,
        agg.currentRaw,
        agg.previousRaw,
        agg.currentCount,
        agg.previousCount,
      ),
    };
    return { rows: [totalsRow] };
  }

  // grouping === "team"
  return { rows: groupByTeam(rows, metrics) };
}

function groupByTeam(rows: MergedRow[], metrics: MetricRow[]): Row[] {
  type Group = {
    key: string;
    label: string;
    teamId: string | number | null;
    members: MergedRow[];
  };

  const groups = new Map<string, Group>();
  for (const r of rows) {
    const teamIdRaw = r.dimension.team_id;
    const teamName = r.dimension.team_name;

    const groupKey =
      teamIdRaw == null ||
      teamIdRaw === "" ||
      teamIdRaw === 0 ||
      teamIdRaw === "unknown"
        ? "unknown"
        : String(teamIdRaw);
    let group = groups.get(groupKey);
    if (!group) {
      const label =
        typeof teamName === "string" && teamName.length > 0
          ? teamName
          : `Команда ${groupKey}`;
      group = {
        key: groupKey,
        label,
        teamId:
          typeof teamIdRaw === "string" || typeof teamIdRaw === "number"
            ? teamIdRaw
            : null,
        members: [],
      };
      groups.set(groupKey, group);
    }
    group.members.push(r);
  }

  const out: Row[] = [];
  for (const group of groups.values()) {
    const agg = aggregateMergedRows(group.members);
    const sharedGroup = { groupKey: group.key, groupLabel: group.label };

    out.push({
      key: `teamLabel:${group.key}`,
      rowKind: "groupLabel",
      dimension: {},
      metrics: {},
      ...sharedGroup,
    });

    for (const member of group.members) {
      const memberRow = mergedRowToOutput(member, metrics);
      Object.assign(memberRow, sharedGroup);
      out.push(memberRow);
    }

    out.push({
      key: `teamSubtotal:${group.key}`,
      rowKind: "groupSubtotal",
      dimension: {},
      metrics: buildMetricCells(
        metrics,
        agg.currentRaw,
        agg.previousRaw,
        agg.currentCount,
        agg.previousCount,
      ),
      ...sharedGroup,
    });
  }
  return out;
}
