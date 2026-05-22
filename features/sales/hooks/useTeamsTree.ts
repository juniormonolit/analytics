"use client";

/**
 * TanStack Query wrapper around `GET /api/catalog/teams`.
 *
 * The endpoint returns a discriminated union (`kind: "tree" | "flat"`)
 * and we surface that union to consumers verbatim — `DepartmentTreeFilter`
 * branches on `kind` to render the right UI.
 *
 * Cache settings:
 *   - `staleTime`: 5 minutes (catalog rarely changes within a session)
 *   - `refetchOnWindowFocus`: false (set globally in `QueryProvider`)
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  TeamFlat,
  TeamTreeNode,
  TeamsCatalogResponse,
} from "@/app/api/catalog/teams/route";

export type TeamsCatalog =
  | { kind: "tree"; nodes: TeamTreeNode[] }
  | { kind: "flat"; teams: TeamFlat[] };

const TEAMS_QUERY_KEY = ["catalog", "teams"] as const;

async function fetchTeamsCatalog(): Promise<TeamsCatalog> {
  const response = await fetch("/api/catalog/teams", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to load teams: HTTP ${response.status}`);
  }

  const body = (await response.json()) as TeamsCatalogResponse;
  if (body.ok === false) {
    throw new Error(body.error || "Unknown error from /api/catalog/teams");
  }

  if (body.kind === "tree") {
    return { kind: "tree", nodes: body.nodes };
  }
  return { kind: "flat", teams: body.teams };
}

export function useTeamsTree(): UseQueryResult<TeamsCatalog, Error> {
  return useQuery<TeamsCatalog, Error>({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchTeamsCatalog,
    staleTime: 5 * 60 * 1000,
  });
}
