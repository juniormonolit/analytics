import type { ManagerEmployeeAliasRow } from "./types";

export function buildManagerEmployeeAliasLookups(
  rows: readonly ManagerEmployeeAliasRow[],
): {
  byBitrixId: Map<number, ManagerEmployeeAliasRow>;
  byId: Map<string, ManagerEmployeeAliasRow>;
} {
  const byBitrixId = new Map<number, ManagerEmployeeAliasRow>();
  const byId = new Map<string, ManagerEmployeeAliasRow>();
  for (const row of rows) {
    byId.set(row.id, row);
    if (row.bitrix_id != null) byBitrixId.set(row.bitrix_id, row);
  }
  return { byBitrixId, byId };
}
