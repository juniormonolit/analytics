import type { TeamsCatalog } from "@/features/sales/hooks/useTeamsTree";

function collectAllTeams(catalog: TeamsCatalog): Array<{ id: number; name: string }> {
  if (catalog.kind === "flat") {
    return catalog.teams.map((team) => ({ id: team.id, name: team.name }));
  }

  const out: Array<{ id: number; name: string }> = [];
  const walk = (nodes: typeof catalog.nodes) => {
    for (const node of nodes) {
      out.push({ id: node.id, name: node.name });
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(catalog.nodes);
  return out;
}

/**
 * Human-readable scope line for the compact totals view — mirrors the
 * legacy BI caption of selected departments.
 */
export function formatTeamScopeLabel(
  catalog: TeamsCatalog | undefined,
  teamIds: readonly string[],
): string {
  if (!catalog) {
    return teamIds.length === 0 ? "Все отделы" : `Отделы (${teamIds.length})`;
  }

  const allTeams = collectAllTeams(catalog);
  if (teamIds.length === 0) {
    return allTeams.map((team) => team.name).join(", ");
  }

  const selected = new Set(teamIds);
  return allTeams
    .filter((team) => selected.has(team.id))
    .map((team) => team.name)
    .join(", ");
}
