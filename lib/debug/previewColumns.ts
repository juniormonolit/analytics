import type { DebugColumnMeta } from "@/lib/debug/saTables";

export type PreviewColumn = {
  name: string;
  dataType?: string;
};

/**
 * Returns the full column list for table preview: metadata order first,
 * then any extra keys observed in fetched rows.
 */
export function resolvePreviewColumns(
  metaColumns: DebugColumnMeta[],
  rows: ReadonlyArray<Record<string, unknown>>,
): PreviewColumn[] {
  const metaByName = new Map(metaColumns.map((column) => [column.name, column]));
  const orderedNames = metaColumns.map((column) => column.name);
  const seen = new Set(orderedNames);

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        orderedNames.push(key);
      }
    }
  }

  return orderedNames.map((name) => {
    const meta = metaByName.get(name);
    return {
      name,
      dataType: meta?.dataType ?? "unknown",
    };
  });
}
