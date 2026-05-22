import type { MetricDataType } from "@/features/reports/engine/types";

/** HTML input `step` for threshold fields matching metric precision. */
export function thresholdInputStep(
  dataType: MetricDataType,
  decimalPlaces: number,
): string {
  if (dataType === "int") return "1";
  const decimals = Math.max(0, decimalPlaces);
  if (decimals === 0) return "1";
  return String(10 ** -decimals);
}

/** Parse user-typed threshold (ru-RU comma or dot). */
export function parseThresholdInput(
  raw: string,
  dataType: MetricDataType,
): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (dataType === "int") return Math.round(parsed);
  return parsed;
}

/** Display threshold in the same scale as table cells (12.3 → "12,3" for %). */
export function formatThresholdForInput(
  value: number | null | undefined,
  dataType: MetricDataType,
  decimalPlaces: number,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  if (dataType === "int") {
    return String(Math.round(value));
  }
  const decimals = Math.max(0, decimalPlaces);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(value);
}

export function thresholdFieldLabel(dataType: MetricDataType): string {
  switch (dataType) {
    case "percent":
      return "До значения, %";
    case "money":
      return "До значения, ₽";
    default:
      return "До значения";
  }
}

export function thresholdInputMode(
  dataType: MetricDataType,
): "decimal" | "numeric" {
  return dataType === "int" ? "numeric" : "decimal";
}
