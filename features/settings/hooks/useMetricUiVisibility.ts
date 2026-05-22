"use client";

import { useCallback, useEffect, useState } from "react";

import {
  defaultVisibleInReportUi,
  isAlwaysHiddenFromReportUi,
  isVisibleInReportUi,
  readMetricUiVisibilityMap,
  writeMetricUiVisibilityMap,
  type MetricUiVisibilityMap,
} from "@/features/settings/metricUiVisibility";

export function useMetricUiVisibility() {
  const [overrides, setOverrides] = useState<MetricUiVisibilityMap>({});

  useEffect(() => {
    setOverrides(readMetricUiVisibilityMap());
  }, []);

  const setVisible = useCallback((metricId: string, visible: boolean) => {
    if (isAlwaysHiddenFromReportUi(metricId)) return;
    setOverrides((prev) => {
      const next = { ...prev, [metricId]: visible };
      writeMetricUiVisibilityMap(next);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (metricId: string) => isVisibleInReportUi(metricId, overrides),
    [overrides],
  );

  const defaultVisible = useCallback(
    (metricId: string) => defaultVisibleInReportUi(metricId),
    [],
  );

  return {
    overrides,
    isVisible,
    defaultVisible,
    setVisible,
    isAlwaysHidden: isAlwaysHiddenFromReportUi,
  };
}
