import {
  defaultMetricColorSettings,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  paletteEntry,
  type GradientColorId,
  type MetricColorSettings,
  type MetricColorSettingsMap,
  type MetricGradientStop,
} from "./types";

export function normalizeMetricColorSettings(
  input: Partial<MetricColorSettings> | undefined,
): MetricColorSettings {
  const fallback = defaultMetricColorSettings();
  if (!input) return fallback;

  const enabled = input.enabled === true;
  const rawStops = Array.isArray(input.stops) ? input.stops : fallback.stops;
  const stops = rawStops
    .slice(0, MAX_GRADIENT_STOPS)
    .map((stop, index, list) => normalizeStop(stop, index === list.length - 1));

  while (stops.length < MIN_GRADIENT_STOPS) {
    stops.push({ upTo: null, colorId: "gray" });
  }
  stops[stops.length - 1] = {
    ...stops[stops.length - 1],
    upTo: null,
  };

  return { enabled, stops };
}

function normalizeStop(
  stop: Partial<MetricGradientStop>,
  isLast: boolean,
): MetricGradientStop {
  const colorId = isGradientColorId(stop.colorId) ? stop.colorId : "gray";
  const upTo =
    isLast || stop.upTo === null || stop.upTo === undefined
      ? null
      : Number(stop.upTo);
  return {
    colorId,
    upTo: upTo !== null && Number.isFinite(upTo) ? upTo : null,
  };
}

function isGradientColorId(value: unknown): value is GradientColorId {
  return (
    value === "green" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "blue" ||
    value === "gray"
  );
}

export function normalizeMetricColorSettingsMap(
  input: unknown,
): MetricColorSettingsMap {
  if (!input || typeof input !== "object") return {};
  const map: MetricColorSettingsMap = {};
  for (const [metricId, settings] of Object.entries(input)) {
    map[metricId] = normalizeMetricColorSettings(
      settings as Partial<MetricColorSettings>,
    );
  }
  return map;
}

export function resolveMetricValueStyle(
  value: number | null | undefined,
  settings: MetricColorSettings | undefined,
): { backgroundColor: string; color: string } | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (!settings?.enabled) return null;

  const stops = settings.stops;
  if (stops.length === 0) return null;

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const isLast = index === stops.length - 1;
    if (isLast || stop.upTo === null || value <= stop.upTo) {
      const palette = paletteEntry(stop.colorId);
      return { backgroundColor: palette.bg, color: palette.text };
    }
  }

  const last = paletteEntry(stops[stops.length - 1].colorId);
  return { backgroundColor: last.bg, color: last.text };
}

export function resizeGradientStops(
  current: MetricGradientStop[],
  nextCount: number,
): MetricGradientStop[] {
  const count = Math.min(
    MAX_GRADIENT_STOPS,
    Math.max(MIN_GRADIENT_STOPS, nextCount),
  );
  const next = current.slice(0, count).map((stop, index, list) => ({
    ...stop,
    upTo: index === list.length - 1 ? null : stop.upTo,
  }));

  while (next.length < count) {
    const index = next.length;
    next.push({
      colorId: index % 2 === 0 ? "yellow" : "green",
      upTo: index === count - 1 ? null : (index + 1) * 25,
    });
  }

  next[next.length - 1] = { ...next[next.length - 1], upTo: null };
  return next;
}
