import "server-only";

import { buildManagerEmployeeAliasLookups } from "./managerAliasLookups";
import { expandDepartmentFilterIds } from "./departmentsCatalog";
import { createOrgServerClient } from "./client";
import { bitrixUserIdToQueryValues, parseBitrixUserId } from "./parseBitrixId";
import type {
  DepartmentId,
  ManagerEmployeeAliasRow,
  ManagerEmployeeRow,
  OrgDepartmentRow,
  OrgEmployeeRow,
  OrgResolvedHierarchyRow,
} from "./types";

function mapToManagerEmployeeRow(
  managerId: number,
  hierarchy: OrgResolvedHierarchyRow | undefined,
  employee: OrgEmployeeRow | undefined,
): ManagerEmployeeRow {
  const bitrixId =
    parseBitrixUserId(hierarchy?.manager_bitrix_user_id) ??
    parseBitrixUserId(employee?.bitrix_user_id) ??
    managerId;

  const departmentId =
    employee?.department_id ??
    hierarchy?.department_id ??
    ("unknown" as DepartmentId);

  return {
    id: employee?.id ?? String(managerId),
    bitrix_id: bitrixId,
    full_name:
      hierarchy?.manager_name?.trim() ||
      employee?.name?.trim() ||
      "",
    team_id: departmentId,
  };
}

function indexEmployeesByBitrixAndId(rows: OrgEmployeeRow[]): {
  byBitrixId: Map<number, OrgEmployeeRow>;
  byInternalId: Map<string, OrgEmployeeRow>;
} {
  const byBitrixId = new Map<number, OrgEmployeeRow>();
  const byInternalId = new Map<string, OrgEmployeeRow>();
  for (const row of rows) {
    byInternalId.set(row.id, row);
    const bitrixId = parseBitrixUserId(row.bitrix_user_id);
    if (bitrixId != null) byBitrixId.set(bitrixId, row);
  }
  return { byBitrixId, byInternalId };
}

export async function loadManagerEmployeesByManagerIds(
  managerIds: readonly number[],
): Promise<ManagerEmployeeRow[]> {
  const unique = Array.from(new Set(managerIds));
  if (unique.length === 0) return [];

  const org = createOrgServerClient();
  const bitrixKeys = bitrixUserIdToQueryValues(unique);

  const [hierarchyRes, employeesByBitrixRes] = await Promise.all([
    org
      .from("org_resolved_hierarchy")
      .select(
        "manager_bitrix_user_id, manager_name, department_id, department_name, is_active",
      )
      .in("manager_bitrix_user_id", bitrixKeys)
      .eq("is_active", true),
    org
      .from("employees")
      .select("id, bitrix_user_id, name, department_id, bitrix_login")
      .in("bitrix_user_id", bitrixKeys),
  ]);

  if (hierarchyRes.error) {
    throw new Error(
      `org_resolved_hierarchy lookup failed: ${hierarchyRes.error.message}`,
    );
  }
  if (employeesByBitrixRes.error) {
    throw new Error(`org employees lookup failed: ${employeesByBitrixRes.error.message}`);
  }

  const hierarchyByBitrix = new Map<number, OrgResolvedHierarchyRow>();
  for (const row of (hierarchyRes.data ?? []) as OrgResolvedHierarchyRow[]) {
    const bitrixId = parseBitrixUserId(row.manager_bitrix_user_id);
    if (bitrixId != null) hierarchyByBitrix.set(bitrixId, row);
  }

  const employeeRows = (employeesByBitrixRes.data ?? []) as OrgEmployeeRow[];
  const { byBitrixId } = indexEmployeesByBitrixAndId(employeeRows);

  const seen = new Set<number>();
  const result: ManagerEmployeeRow[] = [];
  for (const managerId of unique) {
    if (seen.has(managerId)) continue;
    seen.add(managerId);
    const hierarchy = hierarchyByBitrix.get(managerId);
    const employee = byBitrixId.get(managerId);
    result.push(mapToManagerEmployeeRow(managerId, hierarchy, employee));
  }
  return result;
}

export async function loadManagerEmployeeAliasesByManagerIds(
  managerIds: readonly number[],
): Promise<ManagerEmployeeAliasRow[]> {
  const unique = Array.from(new Set(managerIds));
  if (unique.length === 0) return [];

  const org = createOrgServerClient();
  const bitrixKeys = bitrixUserIdToQueryValues(unique);

  const { data, error } = await org
    .from("employees")
    .select("id, bitrix_user_id")
    .in("bitrix_user_id", bitrixKeys);

  if (error) {
    throw new Error(
      `org employees alias lookup failed: ${error.message}`,
    );
  }

  return ((data ?? []) as Array<{ id: string; bitrix_user_id: string }>).map(
    (row) => ({
      id: row.id,
      bitrix_id: parseBitrixUserId(row.bitrix_user_id),
    }),
  );
}

export async function resolveManagerIdAliasesFromOrg(
  managerId: number,
): Promise<number[]> {
  const ids = new Set<number>([managerId]);
  const rows = await loadManagerEmployeeAliasesByManagerIds([managerId]);
  for (const row of rows) {
    if (row.bitrix_id != null) ids.add(row.bitrix_id);
  }
  return Array.from(ids);
}

export async function loadDepartmentNamesByIds(
  departmentIds: readonly DepartmentId[],
): Promise<Map<DepartmentId, string>> {
  const unique = Array.from(new Set(departmentIds.filter(Boolean)));
  const map = new Map<DepartmentId, string>();
  if (unique.length === 0) return map;

  const org = createOrgServerClient();
  const { data, error } = await org
    .from("departments")
    .select("id, name")
    .in("id", unique);

  if (error) {
    throw new Error(`org departments lookup failed: ${error.message}`);
  }

  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function loadAllDepartments(): Promise<OrgDepartmentRow[]> {
  const org = createOrgServerClient();
  const { data, error } = await org
    .from("departments")
    .select("id, bitrix_department_id, name, parent_bitrix_department_id")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`org departments catalog failed: ${error.message}`);
  }

  return (data ?? []) as OrgDepartmentRow[];
}

/** Map selected department UUIDs to numeric Bitrix ids for `sa.deals.team_id`. */
export async function resolveBitrixDepartmentIds(
  departmentIds: readonly DepartmentId[],
): Promise<number[]> {
  const unique = Array.from(new Set(departmentIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const org = createOrgServerClient();
  const { data, error } = await org
    .from("departments")
    .select("bitrix_department_id")
    .in("id", unique);

  if (error) {
    throw new Error(
      `org departments bitrix id lookup failed: ${error.message}`,
    );
  }

  const result = new Set<number>();
  for (const row of (data ?? []) as Array<{ bitrix_department_id: string }>) {
    const parsed = parseBitrixUserId(row.bitrix_department_id);
    if (parsed != null) result.add(parsed);
  }
  return Array.from(result);
}

export async function loadAllEmployees(): Promise<OrgEmployeeRow[]> {
  const org = createOrgServerClient();
  const { data, error } = await org
    .from("employees")
    .select("id, bitrix_user_id, name, department_id, bitrix_login")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`org employees catalog failed: ${error.message}`);
  }

  return (data ?? []) as OrgEmployeeRow[];
}

/** Selected department ids expanded with ancestors and descendants. */
export async function resolveExpandedDepartmentFilterIds(
  selectedIds: readonly DepartmentId[],
): Promise<DepartmentId[]> {
  if (selectedIds.length === 0) return [];
  const rows = await loadAllDepartments();
  return expandDepartmentFilterIds(selectedIds, rows);
}

export function buildManagerEmployeeLookups(rows: readonly ManagerEmployeeRow[]): {
  byBitrixId: Map<number, ManagerEmployeeRow>;
  byId: Map<string, ManagerEmployeeRow>;
} {
  const byBitrixId = new Map<number, ManagerEmployeeRow>();
  const byId = new Map<string, ManagerEmployeeRow>();
  for (const row of rows) {
    byId.set(row.id, row);
    if (row.bitrix_id != null) byBitrixId.set(row.bitrix_id, row);
  }
  return { byBitrixId, byId };
}

export { buildManagerEmployeeAliasLookups };

export async function loadEmployeeAliasLookupsForManagers(
  managerIds: readonly number[],
): Promise<{
  byBitrixId: Map<number, ManagerEmployeeAliasRow>;
  byId: Map<string, ManagerEmployeeAliasRow>;
}> {
  const rows = await loadManagerEmployeeAliasesByManagerIds(managerIds);
  return buildManagerEmployeeAliasLookups(rows);
}
