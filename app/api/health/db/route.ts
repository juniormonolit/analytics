/**
 * GET /api/health/db
 *
 * Smoke-tests connectivity to both Supabase projects:
 * - `sa` analytics schema (teams count legacy table)
 * - org `public.departments` catalog
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { loadAllDepartments } from "@/lib/org/repository";

export const dynamic = "force-dynamic";

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
    const { count, error } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    const departments = await loadAllDepartments();

    return NextResponse.json({
      ok: true,
      schema: "sa",
      teamsCount: count ?? 0,
      orgDepartmentsCount: departments.length,
    });
  } catch (err) {
    const message = extractErrorMessage(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
