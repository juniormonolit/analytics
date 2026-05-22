"use client";

/**
 * Two-way bridge between the section-level filters store and the URL
 * search params (`from`, `to`, `cfrom`, `cto`, `teams`).
 *
 * Lifecycle:
 *   1. On mount: read current URL params, fall back to defaults for any
 *      missing ones, and call `hydrate` on the store. This makes the
 *      URL the canonical source of truth at navigation boundaries.
 *   2. While mounted: subscribe to store changes and push them back to
 *      the URL via `router.replace`, debounced to avoid flooding the
 *      history during fast interactions like drag-select. We merge
 *      with the existing search params so we never overwrite unrelated
 *      keys (`reportTab=...`, etc.).
 *
 * The hook is idempotent — mounting it multiple times in different
 * subtrees of the same Sales layout would just re-hydrate from the
 * same URL and converge on the same store state.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useFiltersStore, type SalesFilters } from "./filtersStore";
import { parseDepartmentIds } from "@/lib/org/departmentId";
import {
  defaultComparisonPeriod,
  defaultPeriod,
} from "@/lib/period/defaults";
import type { Period } from "@/lib/period/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_DEBOUNCE_MS = 100;

function isValidIso(value: string | null): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

function parsePeriod(
  fromParam: string | null,
  toParam: string | null,
): Period | null {
  if (!isValidIso(fromParam) || !isValidIso(toParam)) return null;
  return { from: fromParam, to: toParam };
}

function parseTeamIds(raw: string | null) {
  return parseDepartmentIds(raw);
}

/**
 * Build the search-param patch corresponding to the current store
 * snapshot. Comparison values are only emitted when they differ from
 * the canonical default for the given current period — this keeps URLs
 * short for the common case.
 */
function buildSearchParams(
  current: URLSearchParams,
  state: SalesFilters,
  today: Date,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());

  next.set("from", state.period.from);
  next.set("to", state.period.to);

  const defaultCmp = defaultComparisonPeriod(state.period, today);
  const cmpIsDefault =
    state.comparisonPeriod.from === defaultCmp.from &&
    state.comparisonPeriod.to === defaultCmp.to;
  if (cmpIsDefault) {
    next.delete("cfrom");
    next.delete("cto");
  } else {
    next.set("cfrom", state.comparisonPeriod.from);
    next.set("cto", state.comparisonPeriod.to);
  }

  if (state.teamIds.length === 0) {
    next.delete("teams");
  } else {
    next.set("teams", state.teamIds.join(","));
  }

  return next;
}

function areSearchParamsEqual(
  left: URLSearchParams,
  right: URLSearchParams,
): boolean {
  const normalizedLeft = new URLSearchParams(left.toString());
  const normalizedRight = new URLSearchParams(right.toString());
  normalizedLeft.sort();
  normalizedRight.sort();
  return normalizedLeft.toString() === normalizedRight.toString();
}

/**
 * Hook mounted once inside the Sales `FilterBar` (client component).
 * Returns nothing — its only side effects are hydrating the store and
 * keeping the URL in sync.
 */
export function useSyncFiltersWithUrl(): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hydrate = useFiltersStore((s) => s.hydrate);
  const period = useFiltersStore((s) => s.period);
  const comparisonPeriod = useFiltersStore((s) => s.comparisonPeriod);
  const teamIds = useFiltersStore((s) => s.teamIds);

  const hydratedRef = useRef(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // First-mount hydration from URL. We intentionally run this once per
  // mount of the FilterBar (not on every search-params change) so that
  // user-driven store updates aren't immediately overwritten by stale
  // URL values during the round-trip.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const today = new Date();
    const periodFromUrl = parsePeriod(
      searchParams.get("from"),
      searchParams.get("to"),
    );
    const cmpFromUrl = parsePeriod(
      searchParams.get("cfrom"),
      searchParams.get("cto"),
    );
    const teamsFromUrl = parseTeamIds(searchParams.get("teams"));

    const resolvedPeriod = periodFromUrl ?? defaultPeriod(today);
    const resolvedComparison =
      cmpFromUrl ?? defaultComparisonPeriod(resolvedPeriod, today);

    hydrate({
      period: resolvedPeriod,
      comparisonPeriod: resolvedComparison,
      teamIds: teamsFromUrl,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced write-back: whenever the store moves, push the new
  // values into the URL. Skip writes until after hydration finished
  // and skip when running on the server.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === "undefined") return;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = setTimeout(() => {
      const today = new Date();
      const next = buildSearchParams(
        searchParams,
        { period, comparisonPeriod, teamIds },
        today,
      );
      if (areSearchParamsEqual(next, searchParams)) {
        return;
      }
      const query = next.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      router.replace(url, { scroll: false });
    }, URL_DEBOUNCE_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [period, comparisonPeriod, teamIds, pathname, router, searchParams]);
}
