/** Internal PK in org `public.departments` (UUID). */
export type DepartmentId = string;

export type OrgDepartmentRow = {
  id: DepartmentId;
  bitrix_department_id: string;
  name: string;
  parent_bitrix_department_id: string | null;
};

export type OrgEmployeeRow = {
  id: string;
  bitrix_user_id: string;
  name: string;
  department_id: DepartmentId | null;
  bitrix_login: string | null;
};

export type OrgResolvedHierarchyRow = {
  manager_bitrix_user_id: string;
  manager_name: string;
  department_id: DepartmentId | null;
  department_name: string | null;
  is_active: boolean;
};

/** Normalized shape consumed by the report engine (legacy field names). */
export type ManagerEmployeeRow = {
  id: string;
  bitrix_id: number | null;
  full_name: string;
  team_id: DepartmentId;
};

export type ManagerEmployeeAliasRow = {
  id: string;
  bitrix_id: number | null;
};
