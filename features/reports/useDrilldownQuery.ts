"use client";

/**
 * TanStack Query wrapper around `POST /api/reports/drilldown`.
 *
 * The query key is composed deterministically from the request body
 * (including `limit` + `offset` for the deals level) so the panel's
 * "Загрузить ещё" button trivially flips the key and triggers a
 * fresh fetch instead of refetching the previous range.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  DrilldownAggregateResponse,
  DrilldownDealsResponse,
  DrilldownErrorResponse,
  DrilldownRequest,
  DrilldownResponse,
} from "./drilldown/types";

async function runDrilldown(
  input: DrilldownRequest,
): Promise<DrilldownAggregateResponse | DrilldownDealsResponse> {
  const res = await fetch("/api/reports/drilldown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  let body: DrilldownResponse | null = null;
  try {
    body = (await res.json()) as DrilldownResponse;
  } catch {
    // Fall through — the !res.ok branch below handles the message.
  }

  if (!res.ok || !body || body.ok === false) {
    const errBody = body as DrilldownErrorResponse | null;
    const message =
      errBody?.error ?? `Drilldown failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return body;
}

/**
 * Build a deterministic query key. Exposed so callers can manually
 * invalidate exactly the same key (e.g. a refresh button).
 */
export function drilldownQueryKey(input: DrilldownRequest): readonly unknown[] {
  return [
    "drilldown",
    input.reportSlug,
    input.level,
    input.rowKey.managerId ?? null,
    input.rowKey.productGroupId ?? null,
    input.metricId ?? null,
    input.dealScope ?? "primary",
    input.period.from,
    input.period.to,
    input.comparisonPeriod.from,
    input.comparisonPeriod.to,
    (input.filters.teamIds ?? []).slice().sort((a, b) => a - b).join(","),
    input.limit ?? null,
    input.offset ?? null,
  ] as const;
}

export function useDrilldownQuery(
  input: DrilldownRequest | null,
  opts?: { enabled?: boolean },
): UseQueryResult<
  DrilldownAggregateResponse | DrilldownDealsResponse,
  Error
> {
  const enabled = (opts?.enabled ?? true) && input !== null;
  return useQuery<
    DrilldownAggregateResponse | DrilldownDealsResponse,
    Error
  >({
    queryKey: input
      ? drilldownQueryKey(input)
      : (["drilldown", "disabled"] as const),
    queryFn: () => {
      if (!input) {
        throw new Error("useDrilldownQuery called with null input");
      }
      return runDrilldown(input);
    },
    enabled,
    staleTime: 60_000,
  });
}
