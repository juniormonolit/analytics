/**
 * Delta formatters — these wrap the base number/money/percent helpers
 * with a leading sign and the real Unicode minus sign (`U+2212`) so
 * `+1 234 ₽` / `−5,0%` align in monospaced and proportional fonts.
 */
import type { MetricColumn } from "@/features/reports/engine/types";

import { formatMoney } from "./money";
import { formatNumber, type NumberFormatOptions } from "./number";
import { formatPercent } from "./percent";

const EM_DASH = "—";
const MINUS = "\u2212";

function isFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Reformat an already-formatted absolute string with an explicit sign
 * prefix. Strips any pre-existing ASCII minus the underlying formatter
 * may have emitted so we can re-emit a real Unicode minus.
 */
function withSignPrefix(formatted: string, value: number): string {
  if (value > 0) return `+${formatted.replace(/^-/, "")}`;
  if (value < 0) return `${MINUS}${formatted.replace(/^-/, "")}`;
  return formatted;
}

export function formatDelta(
  value: number | null | undefined,
  dataType: MetricColumn["dataType"],
  decimalPlaces: number,
): string {
  if (!isFinite(value)) return EM_DASH;
  const opts: NumberFormatOptions = { decimalPlaces };
  const abs = Math.abs(value);
  let formatted: string;
  switch (dataType) {
    case "money":
      formatted = formatMoney(abs, opts);
      break;
    case "percent":
      formatted = formatPercent(abs, opts);
      break;
    case "int":
      formatted = formatNumber(abs, { decimalPlaces: 0 });
      break;
    case "decimal":
    case "months":
    default:
      formatted = formatNumber(abs, opts);
      break;
  }
  return withSignPrefix(formatted, value);
}

/**
 * Format `MetricCell.deltaPercent` (a percent value, already in
 * `0..100` units, can be negative). Returns `"—"` when null.
 */
export function formatDeltaPercent(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  if (!isFinite(value)) return EM_DASH;
  const decimals = options.decimalPlaces ?? 1;
  const abs = Math.abs(value);
  const formatted = formatPercent(abs, { decimalPlaces: decimals });
  return withSignPrefix(formatted, value);
}
