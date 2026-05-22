/**
 * Delta-direction color rules.
 *
 * The catalog v1 doesn't reliably populate `sa.metrics.color_rules`,
 * so we keep an explicit allow-list of "negative metrics" (those where
 * a positive change is bad — e.g. отказы, refusals). Future iterations
 * should source this from `sa.metrics.color_rules` directly.
 */
import type { MetricColumn } from "./engine/types";

/**
 * Metric ids whose semantics invert the default "up=good" rule. Empty
 * for v1 — populated as the catalog grows.
 */
export const NEGATIVE_METRIC_IDS: ReadonlySet<string> = new Set<string>([
  // TODO: source from `sa.metrics.color_rules` in a future iteration.
]);

export type DeltaColor = "positive" | "negative" | "neutral" | null;

/**
 * Map a metric + its delta-percent value to a color bucket. `null`
 * inputs (no comparison data) collapse to `null` so the UI can render
 * the secondary text token.
 */
export function getDeltaColor(
  metric: Pick<MetricColumn, "id">,
  deltaPercent: number | null | undefined,
): DeltaColor {
  if (deltaPercent === null || deltaPercent === undefined) return null;
  if (!Number.isFinite(deltaPercent)) return null;

  const isNegativeMetric = NEGATIVE_METRIC_IDS.has(metric.id);
  if (deltaPercent > 0) return isNegativeMetric ? "negative" : "positive";
  if (deltaPercent < 0) return isNegativeMetric ? "positive" : "negative";
  return "neutral";
}

/**
 * Translate the abstract color bucket into a Tailwind text utility
 * derived from design tokens. Returns the muted secondary token for
 * `null` so callers don't need to special-case it.
 */
export function deltaColorToClass(color: DeltaColor): string {
  switch (color) {
    case "positive":
      return "text-positive";
    case "negative":
      return "text-negative";
    case "neutral":
    case null:
    default:
      return "text-text-secondary";
  }
}
