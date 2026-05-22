/**
 * Central dispatcher for cell-level formatting. Given a raw value
 * (which may be `null` or non-finite) and the metric metadata from the
 * report engine, returns the user-facing string.
 *
 * Used by `ReportTable` for both current- and previous-period cells
 * (deltas live in `formatDelta`/`formatDeltaPercent`).
 */
import type { MetricColumn } from "@/features/reports/engine/types";

import { formatMoney } from "./money";
import { formatNumber } from "./number";
import { formatPercent } from "./percent";

const EM_DASH = "—";

function isFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatCellValue(
  value: number | null | undefined,
  dataType: MetricColumn["dataType"],
  decimalPlaces: number,
): string {
  if (!isFinite(value)) return EM_DASH;
  switch (dataType) {
    case "money":
      return formatMoney(value, { decimalPlaces });
    case "percent":
      return formatPercent(value, { decimalPlaces });
    case "int":
      return formatNumber(value, { decimalPlaces: 0 });
    case "decimal":
    case "months":
    default:
      return formatNumber(value, { decimalPlaces });
  }
}
