/**
 * Percent formatter — input is already a percent value (e.g. `12.3`,
 * NOT `0.123`). Output is `"12,3%"` per `ai_docs/04_METRICS.md`. We
 * format the magnitude via `formatNumber` and append the `%` sign so
 * the comma separator stays consistent across the codebase.
 */
import { formatNumber, type NumberFormatOptions } from "./number";

const EM_DASH = "—";

function isFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatPercent(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  if (!isFinite(value)) return EM_DASH;
  const decimals = options.decimalPlaces ?? 1;
  return `${formatNumber(value, { decimalPlaces: decimals })}%`;
}
