import { describe, expect, it } from "vitest";

import { buildOrgStructure } from "../orgStructureCatalog";
import type { OrgDepartmentRow, OrgEmployeeRow } from "../types";

describe("buildOrgStructure", () => {
  it("groups employees under their departments in the tree", () => {
    const departments: OrgDepartmentRow[] = [
      {
        id: "dept-root",
        bitrix_department_id: "1",
        name: "Root",
        parent_bitrix_department_id: null,
      },
      {
        id: "dept-child",
        bitrix_department_id: "2",
        name: "Child",
        parent_bitrix_department_id: "1",
      },
    ];
    const employees: OrgEmployeeRow[] = [
      {
        id: "emp-1",
        bitrix_user_id: "100",
        name: "Alice",
        department_id: "dept-child",
        bitrix_login: "alice",
      },
      {
        id: "emp-2",
        bitrix_user_id: "101",
        name: "Bob",
        department_id: "dept-root",
        bitrix_login: null,
      },
    ];

    const structure = buildOrgStructure(departments, employees);

    expect(structure.totals.employees).toBe(2);
    expect(structure.departments[0]?.employees[0]?.name).toBe("Bob");
    expect(structure.departments[0]?.children[0]?.employees[0]?.name).toBe(
      "Alice",
    );
  });
});
