import type { TeamTreeNode } from "@/app/api/catalog/teams/route";

import { buildDepartmentTree } from "./departmentsCatalog";
import type { OrgDepartmentRow, OrgEmployeeRow } from "./types";

export type OrgStructureEmployee = {
  id: string;
  bitrixUserId: string;
  name: string;
  bitrixLogin: string | null;
};

export type OrgStructureDepartmentNode = {
  id: string;
  name: string;
  bitrixDepartmentId: string;
  employeeCount: number;
  employees: OrgStructureEmployee[];
  children: OrgStructureDepartmentNode[];
};

export type OrgStructureResponse = {
  departments: OrgStructureDepartmentNode[];
  unassignedEmployees: OrgStructureEmployee[];
  totals: {
    departments: number;
    employees: number;
    unassigned: number;
  };
};

function mapEmployee(row: OrgEmployeeRow): OrgStructureEmployee {
  return {
    id: row.id,
    bitrixUserId: row.bitrix_user_id,
    name: row.name,
    bitrixLogin: row.bitrix_login,
  };
}

function countEmployeesInTree(nodes: OrgStructureDepartmentNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += node.employeeCount;
    total += countEmployeesInTree(node.children);
  }
  return total;
}

export function buildOrgStructure(
  departments: readonly OrgDepartmentRow[],
  employees: readonly OrgEmployeeRow[],
): OrgStructureResponse {
  const byDepartment = new Map<string, OrgStructureEmployee[]>();
  const unassigned: OrgStructureEmployee[] = [];

  for (const employee of employees) {
    const mapped = mapEmployee(employee);
    if (employee.department_id) {
      const bucket = byDepartment.get(employee.department_id) ?? [];
      bucket.push(mapped);
      byDepartment.set(employee.department_id, bucket);
    } else {
      unassigned.push(mapped);
    }
  }

  const metaById = new Map(departments.map((row) => [row.id, row]));

  function toStructureNode(node: TeamTreeNode): OrgStructureDepartmentNode {
    const meta = metaById.get(node.id);
    const deptEmployees = byDepartment.get(node.id) ?? [];
    deptEmployees.sort((a, b) => a.name.localeCompare(b.name, "ru"));

    return {
      id: node.id,
      name: node.name,
      bitrixDepartmentId: meta?.bitrix_department_id ?? "",
      employeeCount: deptEmployees.length,
      employees: deptEmployees,
      children: node.children.map(toStructureNode),
    };
  }

  const departmentNodes = buildDepartmentTree([...departments]).map(
    toStructureNode,
  );
  unassigned.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const assignedCount = countEmployeesInTree(departmentNodes);

  return {
    departments: departmentNodes,
    unassignedEmployees: unassigned,
    totals: {
      departments: departments.length,
      employees: assignedCount + unassigned.length,
      unassigned: unassigned.length,
    },
  };
}
