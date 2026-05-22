import { describe, expect, it } from "vitest";

import { expandDepartmentFilterIds } from "../departmentsCatalog";
import type { OrgDepartmentRow } from "../types";

const MSK_OS = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const MSK_REMOTE = "bbbbbbbb-bbbb-4bbb-8bbb-000000000002";
const MSK_BRANCH = "cccccccc-cccc-4ccc-8ccc-000000000003";

const rows: OrgDepartmentRow[] = [
  {
    id: MSK_BRANCH,
    bitrix_department_id: "100",
    name: "Московский филиал",
    parent_bitrix_department_id: null,
  },
  {
    id: MSK_OS,
    bitrix_department_id: "110",
    name: "МСК ОС",
    parent_bitrix_department_id: "100",
  },
  {
    id: MSK_REMOTE,
    bitrix_department_id: "111",
    name: "МСК Удаленка",
    parent_bitrix_department_id: "110",
  },
];

describe("expandDepartmentFilterIds", () => {
  it("includes ancestors when a leaf department is selected", () => {
    const expanded = expandDepartmentFilterIds([MSK_REMOTE], rows);
    expect(expanded).toContain(MSK_REMOTE);
    expect(expanded).toContain(MSK_OS);
    expect(expanded).toContain(MSK_BRANCH);
  });

  it("includes descendants when a parent department is selected", () => {
    const expanded = expandDepartmentFilterIds([MSK_OS], rows);
    expect(expanded).toContain(MSK_OS);
    expect(expanded).toContain(MSK_REMOTE);
  });
});
