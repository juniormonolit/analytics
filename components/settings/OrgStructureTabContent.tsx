"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/reports/states/ErrorState";
import { TableSkeleton } from "@/components/reports/states/TableSkeleton";
import { useOrgStructure } from "@/features/settings/hooks/useOrgStructure";

import { OrgStructureTreeNode } from "./OrgStructureTreeNode";

export function OrgStructureTabContent() {
  const { data, isLoading, error, refetch } = useOrgStructure();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = search.trim().toLowerCase();
    if (!q) return data;

    function filterDepartment(
      node: (typeof data.departments)[number],
    ): (typeof data.departments)[number] | null {
      const employees = node.employees.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.bitrixUserId.includes(q) ||
          (e.bitrixLogin?.toLowerCase().includes(q) ?? false),
      );
      const children = node.children
        .map(filterDepartment)
        .filter((n): n is NonNullable<typeof n> => n != null);
      const nameMatch = node.name.toLowerCase().includes(q);

      if (!nameMatch && employees.length === 0 && children.length === 0) {
        return null;
      }

      return {
        ...node,
        employees: nameMatch ? node.employees : employees,
        children,
        employeeCount: nameMatch ? node.employeeCount : employees.length,
      };
    }

    const departments = data.departments
      .map(filterDepartment)
      .filter((n): n is NonNullable<typeof n> => n != null);

    const unassignedEmployees = data.unassignedEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.bitrixUserId.includes(q) ||
        (e.bitrixLogin?.toLowerCase().includes(q) ?? false),
    );

    return { ...data, departments, unassignedEmployees };
  }, [data, search]);

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!filtered) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Отделов: {filtered.totals.departments} · Сотрудников:{" "}
          {filtered.totals.employees}
          {filtered.totals.unassigned > 0
            ? ` · Без отдела: ${filtered.totals.unassigned}`
            : ""}
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по отделу или сотруднику…"
          className="w-full max-w-sm rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <div className="rounded-lg border border-border-primary bg-bg-card p-3">
        {filtered.departments.length === 0 && filtered.unassignedEmployees.length === 0 ? (
          <p className="px-2 py-4 text-sm text-text-muted">Ничего не найдено</p>
        ) : (
          <>
            {filtered.departments.map((node) => (
              <OrgStructureTreeNode key={node.id} node={node} depth={0} />
            ))}
            {filtered.unassignedEmployees.length > 0 ? (
              <div className="mt-3 border-t border-border-primary pt-3">
                <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Без отдела ({filtered.unassignedEmployees.length})
                </p>
                {filtered.unassignedEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm"
                  >
                    <span className="text-text-primary">{employee.name}</span>
                    <span className="font-mono text-xs text-text-muted">
                      #{employee.bitrixUserId}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
