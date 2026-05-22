"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  DebugTablePreviewResponse,
  DebugTablePreviewSuccess,
} from "@/app/api/debug/db/table-preview/route";

export type TablePreviewParams = {
  table: string;
  limit: number;
  offset: number;
  sort: string;
  search?: string;
  enabled?: boolean;
};

function buildPreviewKey(params: TablePreviewParams): readonly unknown[] {
  return [
    "debug",
    "db",
    "table-preview",
    params.table,
    params.limit,
    params.offset,
    params.sort,
    params.search ?? "",
  ] as const;
}

async function fetchTablePreview(
  params: TablePreviewParams,
): Promise<DebugTablePreviewSuccess> {
  const search = new URLSearchParams({
    table: params.table,
    limit: String(params.limit),
    offset: String(params.offset),
    sort: params.sort,
  });
  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    search.set("search", trimmedSearch);
  }
  const res = await fetch(`/api/debug/db/table-preview?${search.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as DebugTablePreviewResponse;
  if (body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

export function useDebugTablePreview(
  params: TablePreviewParams,
): UseQueryResult<DebugTablePreviewSuccess, Error> {
  return useQuery<DebugTablePreviewSuccess, Error>({
    queryKey: buildPreviewKey(params),
    queryFn: () => fetchTablePreview(params),
    enabled: (params.enabled ?? true) && params.table.length > 0,
    staleTime: 30_000,
  });
}

export { buildPreviewKey as debugTablePreviewQueryKey };
