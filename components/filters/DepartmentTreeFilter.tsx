"use client";

/**
 * Section-level department filter (org `public.departments`).
 */
import * as Popover from "@radix-ui/react-popover";
import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { TeamFlat, TeamTreeNode } from "@/app/api/catalog/teams/route";
import type { DepartmentId } from "@/lib/org/departmentId";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { useTeamsTree } from "@/features/sales/hooks/useTeamsTree";

import { DepartmentTreeNode, type CheckboxState } from "./DepartmentTreeNode";
import {
  collectSubtreeDepartmentIds,
  pickSalesDepartmentRoots,
  SALES_DEPARTMENT_ROOT_NAME,
} from "@/lib/org/departmentsCatalog";

function computeNodeStates(
  roots: TeamTreeNode[],
  selectedLeaves: Set<DepartmentId>,
): Map<DepartmentId, CheckboxState> {
  const map = new Map<DepartmentId, CheckboxState>();

  function walk(node: TeamTreeNode): { total: number; selected: number } {
    if (node.children.length === 0) {
      const isSelected = selectedLeaves.has(node.id);
      map.set(node.id, isSelected ? "checked" : "unchecked");
      return { total: 1, selected: isSelected ? 1 : 0 };
    }
    let total = 0;
    let selected = 0;
    for (const child of node.children) {
      const counts = walk(child);
      total += counts.total;
      selected += counts.selected;
    }
    let state: CheckboxState = "unchecked";
    if (selected === total && total > 0) state = "checked";
    else if (selected > 0) state = "indeterminate";
    map.set(node.id, state);
    return { total, selected };
  }

  roots.forEach(walk);
  return map;
}

function flatToLeaves(teams: TeamFlat[]): TeamTreeNode[] {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    isActive: team.isActive,
    children: [],
  }));
}

type DepartmentTreeFilterProps = {
  className?: string;
};

export function DepartmentTreeFilter({ className }: DepartmentTreeFilterProps) {
  const teamIds = useFiltersStore((s) => s.teamIds);
  const setTeamIds = useFiltersStore((s) => s.setTeamIds);

  const teamsQuery = useTeamsTree();
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<Set<DepartmentId>>(
    () => new Set(teamIds),
  );
  const [expandedIds, setExpandedIds] = useState<Set<DepartmentId>>(new Set());

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftSelection(new Set(teamIds));
    }
    setIsOpen(next);
  };

  const roots = useMemo<TeamTreeNode[]>(() => {
    if (!teamsQuery.data) return [];
    if (teamsQuery.data.kind === "tree") {
      return pickSalesDepartmentRoots(teamsQuery.data.nodes);
    }
    const salesTeam = teamsQuery.data.teams.find(
      (team) => team.name === SALES_DEPARTMENT_ROOT_NAME,
    );
    return salesTeam ? flatToLeaves([salesTeam]) : [];
  }, [teamsQuery.data]);

  const nodeStates = useMemo(
    () => computeNodeStates(roots, draftSelection),
    [roots, draftSelection],
  );

  const handleToggleSelected = (node: TeamTreeNode) => {
    const subtreeIds = collectSubtreeDepartmentIds(node);
    const next = new Set(draftSelection);
    const allSelected = subtreeIds.every((id) => next.has(id));
    if (allSelected) {
      subtreeIds.forEach((id) => next.delete(id));
    } else {
      subtreeIds.forEach((id) => next.add(id));
    }
    setDraftSelection(next);
  };

  const handleToggleExpanded = (id: DepartmentId) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleApply = () => {
    setTeamIds(Array.from(draftSelection).sort((a, b) => a.localeCompare(b)));
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftSelection(new Set());
  };

  const buttonLabel =
    teamIds.length === 0 ? "Все отделы" : `Отделы (${teamIds.length})`;

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary transition-colors hover:border-input-border-hover ${
            className ?? ""
          }`}
        >
          <Building2
            className="h-4 w-4 text-text-secondary"
            aria-hidden
          />
          <span>{buttonLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 flex w-[300px] flex-col rounded-lg border border-border-primary bg-popover-bg shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between border-b border-border-primary px-3 py-2">
            <span className="text-sm font-medium text-text-primary">
              Отделы
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              Очистить
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto px-2 py-2">
            {teamsQuery.isLoading ? (
              <div className="px-2 py-3 text-sm text-text-muted">
                Загрузка…
              </div>
            ) : teamsQuery.isError ? (
              <div className="px-2 py-3 text-sm text-danger">
                Ошибка загрузки отделов
              </div>
            ) : roots.length === 0 ? (
              <div className="px-2 py-3 text-sm text-text-muted">
                Отделы не найдены
              </div>
            ) : (
              roots.map((root) => (
                <DepartmentTreeNode
                  key={root.id}
                  node={root}
                  selectionByNodeId={nodeStates}
                  expandedIds={expandedIds}
                  onToggleExpanded={handleToggleExpanded}
                  onToggleSelected={handleToggleSelected}
                  depth={0}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border-primary px-3 py-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-accent-primary px-3 py-1.5 text-sm text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              Применить
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
