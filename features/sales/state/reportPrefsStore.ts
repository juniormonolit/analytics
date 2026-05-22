"use client";

/**
 * Per-(user, report) UI preferences for the Sales section.
 *
 * Keys preferences by `ReportSlug` so switching tabs preserves each
 * report's state — the by-managers sort/grouping/metric set is
 * independent from by-product-groups.
 *
 * Persistence (BI-008):
 *   - Reads are pulled from `reportPreferencesRepository` on first
 *     `hydrate(slug)` per slug.
 *   - Writes are pushed back through the repository, debounced 200 ms
 *     so a rapid burst (e.g. column resize drag) collapses into one
 *     storage write.
 *   - Hydration mutates state directly (`set`) without going through
 *     the public setters so it never re-persists what it just loaded.
 *   - `userKey` defaults to `"local"` — when auth lands, callers swap
 *     it to the auth user id via `setUserKey(...)`.
 *
 * The store deliberately avoids Zustand's `persist` middleware: that
 * middleware persists ONE storage key for the entire store, but we
 * need a separate namespaced key per (user, section, report). The
 * explicit hydrate/persist pattern maps cleanly onto the repository
 * interface and stays trivial to swap for the future Supabase impl.
 */
import { create } from "zustand";

import type { Grouping, ReportSlug, DealScope } from "@/features/reports/engine/types";
import { DEFAULT_DEAL_SCOPE } from "@/features/reports/engine/dealScope";
import { stripHiddenReportMetricIds } from "@/features/reports/hiddenReportMetrics";
import { reportPreferencesRepository } from "@/repositories/reportPreferences";

export type SortDirection = "asc" | "desc";

export type SortDescriptor = {
  /**
   * Stable column id, e.g. `dimension:manager_name` or
   * `metric:incoming_deals_count.current`.
   */
  columnId: string;
  direction: SortDirection;
};

export type ComparisonDisplay = "full" | "current";

export type ReportPrefs = {
  metricIds: string[];
  /**
   * Preferred column order. Empty in v1 — column order is currently
   * derived from `metricIds` directly. The field is still persisted
   * so the future picker can override metric order without moving the
   * source-of-truth.
   */
  columnOrder: string[];
  /** Empty in v1 — hiding is "not in metricIds". */
  hiddenColumns: string[];
  /** `columnKey → pixel width`. Populated by future column-resize handles. */
  columnWidths: Record<string, number>;
  grouping: Grouping;
  /** Primary / repeat / all — applied before metric calculation. */
  dealScope: DealScope;
  /** Whether metric columns show comparison / delta sub-columns. */
  comparisonDisplay: ComparisonDisplay;
  sort: SortDescriptor | null;
};

const DEFAULT_PREFS: ReportPrefs = {
  metricIds: ["all_core"],
  columnOrder: [],
  hiddenColumns: [],
  columnWidths: {},
  grouping: "none",
  dealScope: DEFAULT_DEAL_SCOPE,
  comparisonDisplay: "full",
  sort: null,
};

/** Ensures report requests and persisted prefs always have at least one metric. */
export function safeMetricIds(
  metricIds: string[] | null | undefined,
): string[] {
  const normalized =
    Array.isArray(metricIds) && metricIds.length > 0
      ? stripHiddenReportMetricIds(metricIds)
      : [...DEFAULT_PREFS.metricIds];
  return normalized.length > 0 ? normalized : [...DEFAULT_PREFS.metricIds];
}

type PrefsBySlug = Record<ReportSlug, ReportPrefs>;
type HydrationStatus = "idle" | "hydrating" | "hydrated";
type HydrationBySlug = Record<ReportSlug, HydrationStatus>;

const SECTION_SLUG = "sales";
const DEFAULT_USER_KEY = "local";
const PERSIST_DEBOUNCE_MS = 200;

export type ReportPrefsState = {
  bySlug: PrefsBySlug;
  hydrationBySlug: HydrationBySlug;
  userKey: string;
  setUserKey: (userKey: string) => void;
  setMetricIds: (slug: ReportSlug, metricIds: string[]) => void;
  setGrouping: (slug: ReportSlug, grouping: Grouping) => void;
  setDealScope: (slug: ReportSlug, dealScope: DealScope) => void;
  setComparisonDisplay: (
    slug: ReportSlug,
    comparisonDisplay: ComparisonDisplay,
  ) => void;
  setSort: (slug: ReportSlug, sort: SortDescriptor | null) => void;
  setColumnWidth: (slug: ReportSlug, columnKey: string, width: number) => void;
  setColumnOrder: (slug: ReportSlug, columnOrder: string[]) => void;
  setHiddenColumns: (slug: ReportSlug, hiddenColumns: string[]) => void;
  replaceForReport: (slug: ReportSlug, prefs: ReportPrefs) => void;
  reset: (slug: ReportSlug) => void;
  /** Pulls the persisted prefs for `slug` (no-op on the server). */
  hydrate: (slug: ReportSlug) => Promise<void>;
};

function isComparisonSortColumn(columnId: string): boolean {
  return (
    columnId.endsWith(".previous") ||
    columnId.endsWith(".delta") ||
    columnId.endsWith(".deltaPercent")
  );
}

function clonePrefs(prefs: ReportPrefs): ReportPrefs {
  return {
    metricIds: safeMetricIds(prefs.metricIds),
    columnOrder: [...prefs.columnOrder],
    hiddenColumns: [...prefs.hiddenColumns],
    columnWidths: { ...prefs.columnWidths },
    grouping: prefs.grouping,
    dealScope: prefs.dealScope ?? DEFAULT_DEAL_SCOPE,
    comparisonDisplay: prefs.comparisonDisplay ?? "full",
    sort: prefs.sort ? { ...prefs.sort } : null,
  };
}

function buildInitialPrefs(): PrefsBySlug {
  return {
    "by-managers": clonePrefs(DEFAULT_PREFS),
    "by-product-groups": clonePrefs(DEFAULT_PREFS),
  };
}

function buildInitialHydration(): HydrationBySlug {
  return {
    "by-managers": "idle",
    "by-product-groups": "idle",
  };
}

/**
 * Module-level debounce so successive setters for the same slug
 * collapse into a single storage write. Keyed by `userKey + slug` so
 * a future per-user swap doesn't trample another user's pending
 * write.
 */
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePersist(
  userKey: string,
  slug: ReportSlug,
  prefs: ReportPrefs,
): void {
  if (typeof window === "undefined") return;
  const timerKey = `${userKey}.${slug}`;
  const existing = persistTimers.get(timerKey);
  if (existing !== undefined) clearTimeout(existing);
  // Snapshot the prefs at schedule time — by the time the timer
  // fires, the store may have moved on; the snapshot is what the
  // user last touched in this debounce window.
  const snapshot = clonePrefs(prefs);
  const timer = setTimeout(() => {
    persistTimers.delete(timerKey);
    void reportPreferencesRepository.save(
      { userKey, sectionSlug: SECTION_SLUG, reportSlug: slug },
      snapshot,
    );
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(timerKey, timer);
}

export const useReportPrefsStore = create<ReportPrefsState>((set, get) => {
  /**
   * Common write path: applies the patch to `bySlug[slug]` and then
   * schedules a debounced persist of the resulting record. We always
   * persist the FULL record (`save`, not `update`) because the store
   * already holds the entire shape — saving the snapshot avoids a
   * read-modify-write race against another tab.
   */
  function patchSlug(slug: ReportSlug, patch: Partial<ReportPrefs>): void {
    set((state) => ({
      bySlug: {
        ...state.bySlug,
        [slug]: { ...state.bySlug[slug], ...patch },
      },
    }));
    const { userKey, bySlug } = get();
    schedulePersist(userKey, slug, bySlug[slug]);
  }

  return {
    bySlug: buildInitialPrefs(),
    hydrationBySlug: buildInitialHydration(),
    userKey: DEFAULT_USER_KEY,

    setUserKey: (userKey) => set({ userKey }),

    setMetricIds: (slug, metricIds) =>
      patchSlug(slug, { metricIds: safeMetricIds(metricIds) }),

    setGrouping: (slug, grouping) => patchSlug(slug, { grouping }),

    setDealScope: (slug, dealScope) => patchSlug(slug, { dealScope }),

    setComparisonDisplay: (slug, comparisonDisplay) => {
      const current = get().bySlug[slug];
      const sort =
        comparisonDisplay === "current" &&
        current.sort &&
        isComparisonSortColumn(current.sort.columnId)
          ? null
          : current.sort;
      patchSlug(slug, {
        comparisonDisplay,
        sort: sort ? { ...sort } : null,
      });
    },

    setSort: (slug, sort) =>
      patchSlug(slug, { sort: sort ? { ...sort } : null }),

    // TODO(BI-009+): wire into actual column-resize handles inside
    // ReportTable / ReportTableHeader once those land.
    setColumnWidth: (slug, columnKey, width) => {
      const current = get().bySlug[slug];
      patchSlug(slug, {
        columnWidths: { ...current.columnWidths, [columnKey]: width },
      });
    },

    setColumnOrder: (slug, columnOrder) =>
      patchSlug(slug, { columnOrder: [...columnOrder] }),

    setHiddenColumns: (slug, hiddenColumns) =>
      patchSlug(slug, { hiddenColumns: [...hiddenColumns] }),

    replaceForReport: (slug, prefs) => patchSlug(slug, clonePrefs(prefs)),

    reset: (slug) => {
      // Reset both the in-memory state and the persisted record so
      // the user gets a true clean slate.
      set((state) => ({
        bySlug: { ...state.bySlug, [slug]: clonePrefs(DEFAULT_PREFS) },
      }));
      const { userKey } = get();
      const timerKey = `${userKey}.${slug}`;
      const existing = persistTimers.get(timerKey);
      if (existing !== undefined) {
        clearTimeout(existing);
        persistTimers.delete(timerKey);
      }
      void reportPreferencesRepository.clear({
        userKey,
        sectionSlug: SECTION_SLUG,
        reportSlug: slug,
      });
    },

    hydrate: async (slug) => {
      if (typeof window === "undefined") return;
      const status = get().hydrationBySlug[slug];
      if (status === "hydrating" || status === "hydrated") return;
      set((state) => ({
        hydrationBySlug: {
          ...state.hydrationBySlug,
          [slug]: "hydrating",
        },
      }));
      try {
        const stored = await reportPreferencesRepository.get({
          userKey: get().userKey,
          sectionSlug: SECTION_SLUG,
          reportSlug: slug,
        });
        if (stored !== null) {
          const merged = clonePrefs({ ...get().bySlug[slug], ...stored });
          const needsMetricIdsMigration =
            Array.isArray(stored.metricIds) && stored.metricIds.length === 0;
          // Merge stored partial over the current defaults — directly,
          // not via a setter, so we don't immediately re-persist what
          // we just loaded.
          set((state) => ({
            bySlug: {
              ...state.bySlug,
              [slug]: merged,
            },
          }));
          if (needsMetricIdsMigration) {
            schedulePersist(get().userKey, slug, merged);
          }
        }
      } finally {
        set((state) => ({
          hydrationBySlug: {
            ...state.hydrationBySlug,
            [slug]: "hydrated",
          },
        }));
      }
    },
  };
});

/**
 * Convenience selector — returns the prefs for a given report slug
 * without forcing every consumer to traverse `bySlug` manually.
 */
export function selectPrefsFor(
  state: ReportPrefsState,
  slug: ReportSlug,
): ReportPrefs {
  return state.bySlug[slug];
}

/**
 * Returns whether the given slug has finished its first hydration
 * pass. Components that want to avoid flashing default values can
 * gate rendering on this.
 */
export function selectIsHydrated(
  state: ReportPrefsState,
  slug: ReportSlug,
): boolean {
  return state.hydrationBySlug[slug] === "hydrated";
}
