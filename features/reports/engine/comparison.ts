/**
 * Merge intermediate rows from the current period and the comparison
 * period into a single list of `MergedRow`s keyed by the report's
 * dimension key.
 *
 * Dimension labels (e.g. `manager_name`, `team_name`) are taken from
 * whichever side has them; when both sides have a label for a given
 * key, the current period wins. Missing values default to `0` for
 * counts and `{}` for raw maps so downstream code never has to deal
 * with `undefined`.
 */
import type { IntermediateRow, MergedRow } from "./types";

export function mergeByDimension(
  current: IntermediateRow[],
  previous: IntermediateRow[],
): MergedRow[] {
  const byKey = new Map<string, MergedRow>();

  for (const row of current) {
    byKey.set(row.key, {
      key: row.key,
      dimension: { ...row.dimension },
      currentCount: row.count,
      previousCount: 0,
      currentRaw: row.raw,
      previousRaw: {},
    });
  }

  for (const row of previous) {
    const existing = byKey.get(row.key);
    if (existing) {
      existing.previousCount = row.count;
      existing.previousRaw = row.raw;
      // Fill in any dimension fields the previous side knows but
      // the current side didn't (e.g. a manager who was active
      // only in the previous period would otherwise show `null`s).
      existing.dimension = { ...row.dimension, ...existing.dimension };
    } else {
      byKey.set(row.key, {
        key: row.key,
        dimension: { ...row.dimension },
        currentCount: 0,
        previousCount: row.count,
        currentRaw: {},
        previousRaw: row.raw,
      });
    }
  }

  return Array.from(byKey.values());
}
