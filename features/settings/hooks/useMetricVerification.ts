"use client";

import { useCallback, useEffect, useState } from "react";

export const METRIC_VERIFICATION_STORAGE_KEY =
  "bi.debug.metrics.verification.v1";

export type MetricVerificationEntry = {
  isVerified: boolean;
  updatedAt: string;
};

export type MetricVerificationMap = Record<string, MetricVerificationEntry>;

function readVerificationMap(): MetricVerificationMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(METRIC_VERIFICATION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MetricVerificationMap;
  } catch {
    return {};
  }
}

function writeVerificationMap(map: MetricVerificationMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      METRIC_VERIFICATION_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function useMetricVerification() {
  const [map, setMap] = useState<MetricVerificationMap>({});

  useEffect(() => {
    setMap(readVerificationMap());
  }, []);

  const setVerified = useCallback((metricId: string, isVerified: boolean) => {
    setMap((prev) => {
      const next = {
        ...prev,
        [metricId]: {
          isVerified,
          updatedAt: new Date().toISOString(),
        },
      };
      writeVerificationMap(next);
      return next;
    });
  }, []);

  const isVerified = useCallback(
    (metricId: string) => map[metricId]?.isVerified === true,
    [map],
  );

  return { isVerified, setVerified };
}
