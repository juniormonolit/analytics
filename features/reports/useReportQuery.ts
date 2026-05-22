"use client";

/**
 * TanStack Query wrapper around `POST /api/reports/run`.
 *
 * The query key is composed deterministically from the request body
 * so two identical requests share a cache entry (and a refetch is a
 * single network call). Mutations of `metricIds` / `grouping` /
 * filters all flip the key and trigger a fresh fetch.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  RunReportRequest,
  RunReportResponse,
} from "./engine/types";

async function runReport(input: RunReportRequest): Promise<RunReportResponse> {
  const res = await fetch("/api/reports/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Report run failed (${res.status}): ${text}`);
  }
  return (await res.json()) as RunReportResponse;
}

/**
 * Build the query key. Exposed for callers that need to invalidate
 * exactly the same key (e.g. the toolbar's refresh button).
 */
export function reportQueryKey(input: RunReportRequest): readonly unknown[] {
  return [
    "report",
    input.reportSlug,
    input.period.from,
    input.period.to,
    input.comparisonPeriod.from,
    input.comparisonPeriod.to,
    (input.filters.teamIds ?? []).slice().sort((a, b) => a.localeCompare(b)).join(","),
    input.metricIds.slice().join(","),
    input.grouping,
    input.dealScope ?? "primary",
    (input.uiHiddenMetricIds ?? []).slice().sort().join(","),
  ] as const;
}

export function useReportQuery(
  input: RunReportRequest,
  opts?: { enabled?: boolean },
): UseQueryResult<RunReportResponse, Error> {
  return useQuery<RunReportResponse, Error>({
    queryKey: reportQueryKey(input),
    queryFn: () => runReport(input),
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}
