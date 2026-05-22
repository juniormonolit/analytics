import "server-only";

/**
 * `POST /api/reports/run`
 *
 * Single entry point for the report engine. The handler is intentionally
 * minimal — it parses + validates the JSON body with zod, hands the
 * parsed request to `runReport()`, and shapes errors into a stable
 * `{ ok: false, error, issues? }` envelope.
 *
 * Anything substantive (catalog lookup, period filtering, aggregation,
 * grouping, totals) lives in `features/reports/engine/*` so the math
 * stays pure / testable and the route stays trivial.
 *
 * Forced dynamic — this route reads from Supabase per-request and must
 * never be statically pre-rendered at build time.
 */
import { NextResponse } from "next/server";

import { runReport } from "@/features/reports/engine/runReport";
import { runReportRequestSchema } from "@/features/reports/engine/schema";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = runReportRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const supabase = createServerClient();
    const result = await runReport(parsed.data, supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(err) },
      { status: 500 },
    );
  }
}
