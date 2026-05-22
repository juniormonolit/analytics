"use client";

import { create } from "zustand";

import { STUB_AUTH_USER_KEY } from "@/lib/auth/stubAuth";

import {
  defaultMetricColorSettings,
  type MetricColorSettings,
  type MetricColorSettingsMap,
} from "./types";
import {
  deserializeMetricColorSettingsMap,
  metricColorSettingsStorageKey,
  readMetricColorSettingsFromLocalStorage,
  serializeMetricColorSettingsMap,
  writeMetricColorSettingsToLocalStorage,
} from "./storage";

type HydrationStatus = "idle" | "hydrating" | "hydrated";

type MetricColorSettingsState = {
  settingsByMetricId: MetricColorSettingsMap;
  hydrationStatus: HydrationStatus;
  userKey: string;
  setUserKey: (userKey: string) => void;
  hydrate: () => Promise<void>;
  getSettings: (metricId: string) => MetricColorSettings;
  updateSettings: (
    metricId: string,
    patch: Partial<MetricColorSettings> | MetricColorSettings,
  ) => void;
  resetSettings: (metricId: string) => void;
};

async function fetchAccountPayload(): Promise<unknown | null> {
  const storageKey = metricColorSettingsStorageKey();
  const response = await fetch(
    `/api/account/storage/${encodeURIComponent(storageKey)}`,
  );
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Failed to load metric color settings (${response.status})`);
  }
  const json = (await response.json()) as { payload?: unknown };
  return json.payload ?? null;
}

async function persistAccountPayload(payload: unknown): Promise<boolean> {
  const storageKey = metricColorSettingsStorageKey();
  const response = await fetch(
    `/api/account/storage/${encodeURIComponent(storageKey)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    },
  );
  return response.ok;
}

export const useMetricColorSettingsStore = create<MetricColorSettingsState>(
  (set, get) => ({
    settingsByMetricId: {},
    hydrationStatus: "idle",
    userKey: STUB_AUTH_USER_KEY,

    setUserKey: (userKey) => set({ userKey, hydrationStatus: "idle" }),

    hydrate: async () => {
      if (typeof window === "undefined") return;
      const status = get().hydrationStatus;
      if (status === "hydrating" || status === "hydrated") return;

      set({ hydrationStatus: "hydrating" });
      const userKey = get().userKey;

      try {
        const remotePayload = await fetchAccountPayload();
        if (remotePayload) {
          set({
            settingsByMetricId: deserializeMetricColorSettingsMap(remotePayload),
            hydrationStatus: "hydrated",
          });
          writeMetricColorSettingsToLocalStorage(
            userKey,
            deserializeMetricColorSettingsMap(remotePayload),
          );
          return;
        }
      } catch {
        // Fall back to local cache below.
      }

      set({
        settingsByMetricId: readMetricColorSettingsFromLocalStorage(userKey),
        hydrationStatus: "hydrated",
      });
    },

    getSettings: (metricId) =>
      get().settingsByMetricId[metricId] ?? defaultMetricColorSettings(),

    updateSettings: (metricId, patch) => {
      const current =
        get().settingsByMetricId[metricId] ?? defaultMetricColorSettings();
      const nextSettings: MetricColorSettings = {
        ...current,
        ...patch,
        stops: patch.stops ?? current.stops,
      };
      const settingsByMetricId = {
        ...get().settingsByMetricId,
        [metricId]: nextSettings,
      };
      set({ settingsByMetricId });

      const userKey = get().userKey;
      writeMetricColorSettingsToLocalStorage(userKey, settingsByMetricId);
      void persistAccountPayload(
        serializeMetricColorSettingsMap(settingsByMetricId),
      );
    },

    resetSettings: (metricId) => {
      const settingsByMetricId = { ...get().settingsByMetricId };
      delete settingsByMetricId[metricId];
      set({ settingsByMetricId });

      const userKey = get().userKey;
      writeMetricColorSettingsToLocalStorage(userKey, settingsByMetricId);
      void persistAccountPayload(
        serializeMetricColorSettingsMap(settingsByMetricId),
      );
    },
  }),
);
