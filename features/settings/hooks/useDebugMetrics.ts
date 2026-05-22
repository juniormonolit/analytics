"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  DebugMetricsResponse,
  DebugMetricsSuccess,
} from "@/app/api/debug/metrics/route";

const DEBUG_METRICS_QUERY_KEY = ["debug", "metrics"] as const;

async function fetchDebugMetrics(): Promise<DebugMetricsSuccess> {
  const res = await fetch("/api/debug/metrics", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Debug metrics fetch failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as DebugMetricsResponse;
  if (body.ok === false) {
    throw new Error(body.error || "Unknown error");
  }
  return body;
}

export function useDebugMetrics(): UseQueryResult<DebugMetricsSuccess, Error> {
  return useQuery<DebugMetricsSuccess, Error>({
    queryKey: DEBUG_METRICS_QUERY_KEY,
    queryFn: fetchDebugMetrics,
    staleTime: 60_000,
  });
}
