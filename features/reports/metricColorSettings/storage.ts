import {
  ACCOUNT_STORAGE_KEYS,
  unwrapAccountPayload,
  wrapAccountPayload,
} from "@/lib/accountStorage/keys";

import { normalizeMetricColorSettingsMap } from "./gradient";
import type { MetricColorSettingsMap } from "./types";

export const METRIC_COLOR_SETTINGS_LOCAL_PREFIX = "bi.metrics.colorSettings";

export function metricColorSettingsLocalKey(userKey: string): string {
  return `${METRIC_COLOR_SETTINGS_LOCAL_PREFIX}.${userKey}.v1`;
}

export function metricColorSettingsStorageKey(): string {
  return ACCOUNT_STORAGE_KEYS.metricColorSettings;
}

export function serializeMetricColorSettingsMap(
  map: MetricColorSettingsMap,
): unknown {
  return wrapAccountPayload(map);
}

export function deserializeMetricColorSettingsMap(
  payload: unknown,
): MetricColorSettingsMap {
  const unwrapped = unwrapAccountPayload<MetricColorSettingsMap>(payload);
  return normalizeMetricColorSettingsMap(unwrapped ?? payload);
}

export function readMetricColorSettingsFromLocalStorage(
  userKey: string,
): MetricColorSettingsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(
      metricColorSettingsLocalKey(userKey),
    );
    if (!raw) return {};
    return deserializeMetricColorSettingsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeMetricColorSettingsToLocalStorage(
  userKey: string,
  map: MetricColorSettingsMap,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      metricColorSettingsLocalKey(userKey),
      JSON.stringify(serializeMetricColorSettingsMap(map)),
    );
  } catch {
    // ignore quota errors
  }
}
