import "server-only";

/**
 * `GET /api/catalog/metrics`
 *
 * Returns the active metrics catalog from `sa.metrics`. The browser
 * `<MetricPickerModal />` uses this list to populate its checkbox list,
 * tag filter and preview. Sort order honours `sa.metrics.sort_order`
 * (admin-controlled) so admins can curate which metrics appear at the
 * top.
 */
import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";
import { isAlwaysHiddenFromReportUi } from "@/features/settings/metricUiVisibility";
import type { Database } from "@/lib/supabase/types.generated";

export const dynamic = "force-dynamic";

export type MetricCatalogRow = Database["sa"]["Tables"]["metrics"]["Row"];

export type MetricsCatalogSuccess = {
  ok: true;
  metrics: MetricCatalogRow[];
};

export type MetricsCatalogError = {
  ok: false;
  error: string;
};

export type MetricsCatalogResponse =
  | MetricsCatalogSuccess
  | MetricsCatalogError;

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("metrics")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const body: MetricsCatalogSuccess = {
      ok: true,
      metrics: ((data ?? []) as MetricCatalogRow[]).filter(
        (metric) => !isAlwaysHiddenFromReportUi(metric.id),
      ),
    };
    return NextResponse.json(body);
  } catch (err) {
    const body: MetricsCatalogError = {
      ok: false,
      error: extractErrorMessage(err),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
