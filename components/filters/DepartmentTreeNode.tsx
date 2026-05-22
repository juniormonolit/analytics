"use client";

/**
 * Recursive tree node used by `DepartmentTreeFilter`.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

import type { TeamTreeNode } from "@/app/api/catalog/teams/route";
import type { DepartmentId } from "@/lib/org/departmentId";

export type CheckboxState = "checked" | "unchecked" | "indeterminate";

type DepartmentTreeNodeProps = {
  node: TeamTreeNode;
  selectionByNodeId: Map<DepartmentId, CheckboxState>;
  expandedIds: Set<DepartmentId>;
  onToggleExpanded: (id: DepartmentId) => void;
  onToggleSelected: (node: TeamTreeNode) => void;
  depth: number;
};

function TriStateCheckbox({
  state,
  ariaLabel,
  onChange,
}: {
  state: CheckboxState;
  ariaLabel: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === "indeterminate";
    }
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "checked"}
      onChange={onChange}
      aria-label={ariaLabel}
      aria-checked={state === "indeterminate" ? "mixed" : state === "checked"}
      className="h-4 w-4 cursor-pointer accent-[var(--accent-primary)]"
    />
  );
}

export function DepartmentTreeNode({
  node,
  selectionByNodeId,
  expandedIds,
  onToggleExpanded,
  onToggleSelected,
  depth,
}: DepartmentTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const state = selectionByNodeId.get(node.id) ?? "unchecked";

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md py-1 hover:bg-bg-card-hover"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(node.id)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary ${
            hasChildren ? "visible" : "invisible"
          }`}
          aria-label={isExpanded ? "Свернуть" : "Развернуть"}
          tabIndex={hasChildren ? 0 : -1}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </button>

        <TriStateCheckbox
          state={state}
          ariaLabel={node.name}
          onChange={() => onToggleSelected(node)}
        />

        <button
          type="button"
          onClick={() => onToggleSelected(node)}
          className="min-w-0 flex-1 truncate text-left text-sm text-text-primary"
        >
          {node.name}
        </button>
      </div>

      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <DepartmentTreeNode
              key={child.id}
              node={child}
              selectionByNodeId={selectionByNodeId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onToggleSelected={onToggleSelected}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}
