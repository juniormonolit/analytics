"use client";

import { useQuery } from "@tanstack/react-query";

import type { OrgStructureApiResponse } from "@/app/api/catalog/org-structure/route";

export type OrgStructureData = Extract<OrgStructureApiResponse, { ok: true }>;

const ORG_STRUCTURE_QUERY_KEY = ["catalog", "org-structure"] as const;

async function fetchOrgStructure(): Promise<OrgStructureData> {
  const response = await fetch("/api/catalog/org-structure", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to load org structure: HTTP ${response.status}`);
  }

  const body = (await response.json()) as OrgStructureApiResponse;
  if (body.ok === false) {
    throw new Error(body.error || "Unknown error from /api/catalog/org-structure");
  }

  return body;
}

export function useOrgStructure() {
  return useQuery<OrgStructureData, Error>({
    queryKey: ORG_STRUCTURE_QUERY_KEY,
    queryFn: fetchOrgStructure,
    staleTime: 5 * 60 * 1000,
  });
}
