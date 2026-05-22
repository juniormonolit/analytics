import "server-only";

/**
 * `POST /api/reports/drilldown`
 *
 * Entry point for the drill-down API. Validates the JSON body with
 * zod, dispatches to the right level handler via `runDrilldown()`,
 * and shapes errors into the standard `{ ok: false, error, issues? }`
 * envelope.
 *
 * Forced dynamic — this route reads from Supabase per request and
 * must never be statically pre-rendered at build time.
 */
import { NextResponse } from "next/server";

import { runDrilldown } from "@/features/reports/drilldown/runDrilldown";
import { drilldownRequestSchema } from "@/features/reports/drilldown/schema";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
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

  const parsed = drilldownRequestSchema.safeParse(raw);
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
    const result = await runDrilldown(parsed.data, supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(err) },
      { status: 500 },
    );
  }
}
