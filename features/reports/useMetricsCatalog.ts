"use client";

/**
 * TanStack Query wrapper around `GET /api/catalog/metrics`.
 *
 * The catalog rarely changes within a session, so a long staleTime
 * (5 minutes) is appropriate. Consumers — `MetricPickerModal` mostly —
 * can read `data?.metrics` directly without re-fetching.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  MetricCatalogRow,
  MetricsCatalogResponse,
} from "@/app/api/catalog/metrics/route";

const METRICS_QUERY_KEY = ["catalog", "metrics"] as const;

export type MetricsCatalog = {
  metrics: MetricCatalogRow[];
};

async function fetchMetricsCatalog(): Promise<MetricsCatalog> {
  const res = await fetch("/api/catalog/metrics", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Metrics catalog fetch failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as MetricsCatalogResponse;
  if (body.ok === false) {
    throw new Error(body.error || "Unknown error");
  }
  return { metrics: body.metrics };
}

export function useMetricsCatalog(): UseQueryResult<MetricsCatalog, Error> {
  return useQuery<MetricsCatalog, Error>({
    queryKey: METRICS_QUERY_KEY,
    queryFn: fetchMetricsCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

export type { MetricCatalogRow };
