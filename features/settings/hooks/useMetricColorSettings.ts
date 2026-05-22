"use client";

import { useCallback, useEffect } from "react";

import { useMetricColorSettingsStore } from "@/features/reports/metricColorSettings/metricColorSettingsStore";
import type { MetricColorSettings } from "@/features/reports/metricColorSettings/types";

export function useMetricColorSettings() {
  const settingsByMetricId = useMetricColorSettingsStore(
    (state) => state.settingsByMetricId,
  );
  const hydrate = useMetricColorSettingsStore((state) => state.hydrate);
  const updateSettings = useMetricColorSettingsStore(
    (state) => state.updateSettings,
  );
  const resetSettings = useMetricColorSettingsStore(
    (state) => state.resetSettings,
  );
  const getSettings = useMetricColorSettingsStore((state) => state.getSettings);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const getSettingsForMetric = useCallback(
    (metricId: string) => settingsByMetricId[metricId] ?? getSettings(metricId),
    [getSettings, settingsByMetricId],
  );

  const setSettings = useCallback(
    (metricId: string, settings: MetricColorSettings) => {
      updateSettings(metricId, settings);
    },
    [updateSettings],
  );

  return {
    settingsByMetricId,
    getSettingsForMetric,
    setSettings,
    resetSettings,
  };
}
