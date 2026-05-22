import "server-only";

/**
 * Shared utilities for drill-down level handlers.
 *
 * - `exclusiveEndDate` mirrors the engine's half-open interval rule
 *   so deals filtered by `created_at` include the whole `to` day.
 * - `SYNTHETIC_METRIC_COLUMNS` mirrors the engine's `by-product-groups`
 *   metric set so the panel can render the same column shape.
 * - `toFiniteAmount` coerces the numeric column to `number` since
 *   Supabase may return `numeric` values as strings depending on the
 *   driver settings.
 *
 * The optional `team_id IN (...)` clause is applied inline at each
 * call site — generic typing of the Supabase filter builder is
 * notoriously brittle and the duplication is one short line.
 */
import { addDays, format, parseISO } from "date-fns";

import type { MetricColumn } from "@/features/reports/engine/types";

export const SYNTHETIC_METRIC_COLUMNS: MetricColumn[] = [
  {
    id: "deals_count",
    label: "Кол-во сделок",
    dataType: "int",
    decimalPlaces: 0,
    aggregationFn: "sum",
    isCalculated: false,
    dependencies: undefined,
    formula: null,
    category: "deals",
  },
  {
    id: "deals_amount",
    label: "Сумма сделок",
    dataType: "money",
    decimalPlaces: 0,
    aggregationFn: "sum",
    isCalculated: false,
    dependencies: undefined,
    formula: null,
    category: "deals",
  },
];

export function exclusiveEndDate(toIso: string): string {
  return format(addDays(parseISO(toIso), 1), "yyyy-MM-dd");
}

export function toFiniteAmount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}
