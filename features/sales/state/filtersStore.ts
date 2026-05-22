"use client";

/**
 * Section-scoped filter state for the Sales section.
 *
 * Source-of-truth ordering:
 *   1. URL search params (`from`, `to`, `cfrom`, `cto`, `teams`).
 *   2. This Zustand store (mirrors the URL on the client; updates push
 *      back into the URL via `useSyncFiltersWithUrl`).
 *   3. Hard-coded defaults (`defaultPeriod` / `defaultComparisonPeriod`)
 *      used only when the URL has nothing.
 *
 * The store does NOT touch the URL itself — that responsibility belongs
 * to `useSyncFiltersWithUrl`, which keeps this file dependency-free of
 * `next/navigation` and therefore SSR-safe.
 */
import { create } from "zustand";

import {
  defaultComparisonPeriod,
  defaultPeriod,
  recomputeComparison,
} from "@/lib/period/defaults";
import type { Period } from "@/lib/period/types";
import type { DepartmentId } from "@/lib/org/departmentId";

export type SalesFilters = {
  /** Currently visible period (drives all primary aggregations). */
  period: Period;
  /** Period used for the comparison columns. */
  comparisonPeriod: Period;
  /**
   * Selected org department ids (UUID). Empty array = all departments.
   */
  teamIds: DepartmentId[];
};

export type FiltersState = SalesFilters & {
  setPeriod: (period: Period) => void;
  /** Updates only the current period — comparison stays unchanged. */
  setPeriodOnly: (period: Period) => void;
  setPeriodPair: (period: Period, comparisonPeriod: Period) => void;
  setComparisonPeriod: (comparisonPeriod: Period) => void;
  setTeamIds: (teamIds: DepartmentId[]) => void;
  /** Used by the URL-sync hook on first mount. */
  hydrate: (state: Partial<SalesFilters>) => void;
};

/**
 * Compute the initial value used for SSR and the very first client
 * render before `useSyncFiltersWithUrl` has had a chance to hydrate
 * from the URL. We freeze "today" at module-evaluation time so every
 * call to the store sees the same defaults — the URL hook is what
 * picks up real values.
 */
function buildInitialFilters(): SalesFilters {
  const today = new Date();
  const period = defaultPeriod(today);
  const comparisonPeriod = defaultComparisonPeriod(period, today);
  return { period, comparisonPeriod, teamIds: [] };
}

export const useFiltersStore = create<FiltersState>((set) => ({
  ...buildInitialFilters(),

  setPeriod: (period) => {
    // Keep the comparison range synchronized with the new current
    // period using the canonical "tail of previous month" rule.
    const comparisonPeriod = recomputeComparison(period, new Date());
    set({ period, comparisonPeriod });
  },

  setPeriodOnly: (period) => {
    set({ period });
  },

  setPeriodPair: (period, comparisonPeriod) => {
    set({ period, comparisonPeriod });
  },

  setComparisonPeriod: (comparisonPeriod) => {
    set({ comparisonPeriod });
  },

  setTeamIds: (teamIds) => {
    set({ teamIds });
  },

  hydrate: (next) => {
    set((prev) => ({ ...prev, ...next }));
  },
}));
