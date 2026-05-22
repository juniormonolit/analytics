/**
 * Money formatter — outputs Russian-style currency strings such as
 * `"1 234 567 ₽"`. We use the `Intl` currency formatter rather than
 * suffixing the symbol manually so locale-aware spacing and symbol
 * placement are handled correctly.
 */
import type { NumberFormatOptions } from "./number";

const EM_DASH = "—";

function isFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Format a numeric amount as Russian rubles. Defaults to 0 decimal
 * places to match `ai_docs/04_METRICS.md` (`1 234 567 ₽`).
 */
export function formatMoney(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  if (!isFinite(value)) return EM_DASH;
  const decimals = options.decimalPlaces ?? 0;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    currencyDisplay: "symbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
