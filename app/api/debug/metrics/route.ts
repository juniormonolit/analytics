import "server-only";

/**
 * GET /api/debug/metrics
 *
 * Returns all metrics from `sa.metrics` (active and inactive) for the
 * internal debug UI.
 */
import { NextResponse } from "next/server";

import type { DebugMetricRow } from "@/lib/debug/metricExplanation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type DebugMetricsSuccess = {
  ok: true;
  metrics: DebugMetricRow[];
};

export type DebugMetricsError = {
  ok: false;
  error: string;
};

export type DebugMetricsResponse = DebugMetricsSuccess | DebugMetricsError;

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "unknown error";
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("metrics")
      .select(
        "id, name_ru, name_short_ru, metric_type, data_type, aggregation_fn, source, source_column, formula, dependencies, category, is_core, is_active, sort_order",
      )
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const body: DebugMetricsSuccess = {
      ok: true,
      metrics: (data ?? []) as DebugMetricRow[],
    };
    return NextResponse.json(body);
  } catch (err) {
    const body: DebugMetricsError = {
      ok: false,
      error: extractErrorMessage(err),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
