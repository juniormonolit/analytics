/**
 * Russian-locale number formatting helpers shared by the report table and
 * any UI surface that displays raw catalog values.
 *
 * Implementation notes:
 *   - We rely on `Intl.NumberFormat("ru-RU", ...)` for grouping + decimal
 *     separator. Node and modern browsers emit a narrow no-break space
 *     (`U+00A0`) as the thousands separator; we leave it as-is — it
 *     renders as a regular thin space in tables and copies to clipboard
 *     intact.
 *   - All formatters accept `null`/`undefined`/non-finite inputs and
 *     return the em-dash placeholder `"—"` so callers can pass raw
 *     `MetricCell.current` values without pre-checks.
 */

const EM_DASH = "—";

function isFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export type NumberFormatOptions = {
  decimalPlaces?: number;
};

/**
 * Format a plain number in Russian locale with optional fixed decimals.
 *
 * Examples (with `decimalPlaces = 0`):
 *   `1234`     → `"1 234"`
 *   `1234.56`  → `"1 235"`
 *
 * Examples (with `decimalPlaces = 1`):
 *   `1234`     → `"1 234,0"`
 *   `1234.56`  → `"1 234,6"`
 */
export function formatNumber(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  if (!isFinite(value)) return EM_DASH;
  const decimals = options.decimalPlaces ?? 0;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
