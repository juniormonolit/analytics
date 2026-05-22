import type { TeamFlat, TeamTreeNode } from "@/app/api/catalog/teams/route";

import type { DepartmentId, OrgDepartmentRow } from "./types";

/** Root department shown in the sales section filter. */
export const SALES_DEPARTMENT_ROOT_NAME = "Отдел продаж";

function findDepartmentNodeByName(
  nodes: readonly TeamTreeNode[],
  name: string,
): TeamTreeNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const nested = findDepartmentNodeByName(node.children, name);
    if (nested) return nested;
  }
  return null;
}

/** Keep only the «Отдел продаж» subtree for the sales filter UI. */
export function pickSalesDepartmentRoots(
  roots: readonly TeamTreeNode[],
): TeamTreeNode[] {
  const salesRoot = findDepartmentNodeByName(roots, SALES_DEPARTMENT_ROOT_NAME);
  return salesRoot ? [salesRoot] : [];
}

/** Department node id plus every descendant id (for filter selection). */
export function collectSubtreeDepartmentIds(node: TeamTreeNode): DepartmentId[] {
  const ids: DepartmentId[] = [node.id];
  for (const child of node.children) {
    ids.push(...collectSubtreeDepartmentIds(child));
  }
  return ids;
}

function indexTreeNodesById(
  nodes: readonly TeamTreeNode[],
  map = new Map<DepartmentId, TeamTreeNode>(),
): Map<DepartmentId, TeamTreeNode> {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children.length > 0) {
      indexTreeNodesById(node.children, map);
    }
  }
  return map;
}

/**
 * Expand selected department ids for report filtering:
 * - each selected id and all its descendants;
 * - every ancestor on the path to the root (covers employees assigned
 *   directly to a parent department like «МСК ОС»).
 */
export function expandDepartmentFilterIds(
  selectedIds: readonly DepartmentId[],
  rows: readonly OrgDepartmentRow[],
): DepartmentId[] {
  const uniqueSelected = Array.from(new Set(selectedIds.filter(Boolean)));
  if (uniqueSelected.length === 0) return [];

  const idByBitrix = new Map<string, DepartmentId>();
  const parentById = new Map<DepartmentId, DepartmentId>();
  for (const row of rows) {
    idByBitrix.set(row.bitrix_department_id, row.id);
    const parentBitrix = row.parent_bitrix_department_id;
    if (parentBitrix != null) {
      const parentId = idByBitrix.get(parentBitrix);
      if (parentId) parentById.set(row.id, parentId);
    }
  }

  const tree = buildDepartmentTree([...rows]);
  const nodeById = indexTreeNodesById(tree);

  const expanded = new Set<DepartmentId>();
  for (const id of uniqueSelected) {
    expanded.add(id);

    let ancestor: DepartmentId | undefined = id;
    while (ancestor) {
      expanded.add(ancestor);
      ancestor = parentById.get(ancestor);
    }

    const node = nodeById.get(id);
    if (node) {
      for (const subId of collectSubtreeDepartmentIds(node)) {
        expanded.add(subId);
      }
    }
  }

  return Array.from(expanded);
}

export function buildDepartmentTree(rows: OrgDepartmentRow[]): TeamTreeNode[] {
  const byBitrixId = new Map<string, TeamTreeNode>();
  for (const row of rows) {
    byBitrixId.set(row.bitrix_department_id, {
      id: row.id,
      name: row.name,
      isActive: true,
      children: [],
    });
  }

  const roots: TeamTreeNode[] = [];
  for (const row of rows) {
    const node = byBitrixId.get(row.bitrix_department_id);
    if (!node) continue;

    const parentBitrixId = row.parent_bitrix_department_id;
    if (parentBitrixId != null && byBitrixId.has(parentBitrixId)) {
      byBitrixId.get(parentBitrixId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function departmentsToFlatList(rows: OrgDepartmentRow[]): TeamFlat[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: true,
  }));
}
