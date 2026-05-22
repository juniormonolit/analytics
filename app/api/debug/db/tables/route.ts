import "server-only";

/**
 * GET /api/debug/db/tables
 *
 * Read-only catalog of whitelisted `sa.*` tables with column metadata
 * and approximate row counts.
 */
import { NextResponse } from "next/server";

import {
  SA_DEBUG_TABLE_NAMES,
  getSaDebugTableMeta,
} from "@/lib/debug/saTables";
import { clientEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type DebugDbTableInfo = {
  tableName: string;
  rowEstimate: number | null;
  columns: Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>;
};

export type DebugDbTablesSuccess = {
  ok: true;
  schema: string;
  tables: DebugDbTableInfo[];
};

export type DebugDbTablesError = {
  ok: false;
  error: string;
};

export type DebugDbTablesResponse = DebugDbTablesSuccess | DebugDbTablesError;

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
    const schema = clientEnv.NEXT_PUBLIC_SUPABASE_SCHEMA;

    const tables = await Promise.all(
      SA_DEBUG_TABLE_NAMES.map(async (tableName) => {
        const meta = getSaDebugTableMeta(tableName);
        let rowEstimate: number | null = null;
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });
          if (!error) {
            rowEstimate = count ?? 0;
          }
        } catch {
          rowEstimate = null;
        }

        return {
          tableName,
          rowEstimate,
          columns: meta.columns.map((column) => ({ ...column })),
        };
      }),
    );

    const body: DebugDbTablesSuccess = {
      ok: true,
      schema,
      tables,
    };
    return NextResponse.json(body);
  } catch (err) {
    const body: DebugDbTablesError = {
      ok: false,
      error: extractErrorMessage(err),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
