"use client";

import { create } from "zustand";

import type { ReportSlug } from "@/features/reports/engine/types";
import { reportSetsRepository } from "@/repositories/reportSets";
import type {
  ReportSetSnapshot,
  SavedReportSet,
} from "@/features/sales/reportSets/types";
import type { DepartmentId } from "@/lib/org/departmentId";
import type { ReportPrefs } from "@/features/sales/state/reportPrefsStore";
import { STUB_AUTH_USER_KEY } from "@/lib/auth/stubAuth";

const SECTION_SLUG = "sales";

type HydrationStatus = "idle" | "hydrating" | "hydrated";

export type ReportSetsState = {
  sets: SavedReportSet[];
  hydrationStatus: HydrationStatus;
  userKey: string;
  setUserKey: (userKey: string) => void;
  hydrate: () => Promise<void>;
  saveSet: (snapshot: ReportSetSnapshot) => SavedReportSet;
  deleteSet: (setId: string) => void;
  getSetById: (setId: string) => SavedReportSet | undefined;
  setToPrefs: (set: SavedReportSet) => Pick<
    ReportPrefs,
    "metricIds" | "grouping" | "dealScope" | "comparisonDisplay"
  >;
};

function createSetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function persistSets(userKey: string, sets: SavedReportSet[]): Promise<void> {
  await reportSetsRepository.save(
    { userKey, sectionSlug: SECTION_SLUG },
    sets,
  );
}

function normalizeSavedReportSet(set: SavedReportSet): SavedReportSet {
  return {
    ...set,
    teamIds: Array.isArray(set.teamIds) ? [...set.teamIds] : [],
  };
}

export const useReportSetsStore = create<ReportSetsState>((set, get) => ({
  sets: [],
  hydrationStatus: "idle",
  userKey: STUB_AUTH_USER_KEY,

  setUserKey: (userKey) => set({ userKey, hydrationStatus: "idle" }),

  hydrate: async () => {
    if (typeof window === "undefined") return;
    const status = get().hydrationStatus;
    if (status === "hydrating" || status === "hydrated") return;
    set({ hydrationStatus: "hydrating" });
    try {
      const sets = (await reportSetsRepository.list({
        userKey: get().userKey,
        sectionSlug: SECTION_SLUG,
      })).map(normalizeSavedReportSet);
      set({ sets });
    } finally {
      set({ hydrationStatus: "hydrated" });
    }
  },

  saveSet: (snapshot) => {
    const now = new Date().toISOString();
    const nextSet: SavedReportSet = {
      id: createSetId(),
      ...snapshot,
      createdAt: now,
      updatedAt: now,
    };
    const sets = [...get().sets, nextSet];
    set({ sets });
    void persistSets(get().userKey, sets);
    return nextSet;
  },

  deleteSet: (setId) => {
    const sets = get().sets.filter((item) => item.id !== setId);
    set({ sets });
    void persistSets(get().userKey, sets);
  },

  getSetById: (setId) => get().sets.find((item) => item.id === setId),

  setToPrefs: (savedSet) => ({
    metricIds: [...savedSet.metricIds],
    grouping: savedSet.grouping,
    dealScope: savedSet.dealScope,
    comparisonDisplay: savedSet.comparisonDisplay,
  }),
}));

export function applySavedReportSet(
  savedSet: SavedReportSet,
): Pick<
  ReportPrefs,
  "metricIds" | "grouping" | "dealScope" | "comparisonDisplay"
> & { teamIds: DepartmentId[] } {
  const { setToPrefs } = useReportSetsStore.getState();
  return {
    ...setToPrefs(savedSet),
    teamIds: [...(savedSet.teamIds ?? [])],
  };
}
