"use client";

import { ChevronDown, ChevronRight, User } from "lucide-react";
import { useState } from "react";

import type {
  OrgStructureDepartmentNode,
  OrgStructureEmployee,
} from "@/lib/org/orgStructureCatalog";

type OrgStructureTreeNodeProps = {
  node: OrgStructureDepartmentNode;
  depth: number;
  defaultExpanded?: boolean;
};

function EmployeeRow({
  employee,
  depth,
}: {
  employee: OrgStructureEmployee;
  depth: number;
}) {
  return (
    <div
      className="flex items-center gap-2 py-1 text-sm text-text-secondary"
      style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
    >
      <User className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
      <span className="min-w-0 truncate text-text-primary">{employee.name}</span>
      <span className="shrink-0 font-mono text-xs text-text-muted">
        #{employee.bitrixUserId}
      </span>
    </div>
  );
}

export function OrgStructureTreeNode({
  node,
  depth,
  defaultExpanded = depth < 2,
}: OrgStructureTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const hasEmployees = node.employees.length > 0;
  const canExpand = hasChildren || hasEmployees;

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md py-1 hover:bg-bg-card-hover"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary ${
            canExpand ? "visible" : "invisible"
          }`}
          aria-label={isExpanded ? "Свернуть" : "Развернуть"}
          tabIndex={canExpand ? 0 : -1}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
          {node.name}
        </span>
        <span className="shrink-0 rounded-full bg-bg-card px-2 py-0.5 text-xs text-text-muted">
          {node.employeeCount}
        </span>
      </div>

      {isExpanded ? (
        <>
          {node.employees.map((employee) => (
            <EmployeeRow key={employee.id} employee={employee} depth={depth} />
          ))}
          {node.children.map((child) => (
            <OrgStructureTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
