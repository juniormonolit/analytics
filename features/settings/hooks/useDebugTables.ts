"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  DebugDbTablesResponse,
  DebugDbTablesSuccess,
} from "@/app/api/debug/db/tables/route";

const DEBUG_TABLES_QUERY_KEY = ["debug", "db", "tables"] as const;

async function fetchDebugTables(): Promise<DebugDbTablesSuccess> {
  const res = await fetch("/api/debug/db/tables", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Debug tables fetch failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as DebugDbTablesResponse;
  if (body.ok === false) {
    throw new Error(body.error || "Unknown error");
  }
  return body;
}

export function useDebugTables(): UseQueryResult<DebugDbTablesSuccess, Error> {
  return useQuery<DebugDbTablesSuccess, Error>({
    queryKey: DEBUG_TABLES_QUERY_KEY,
    queryFn: fetchDebugTables,
    staleTime: 60_000,
  });
}
