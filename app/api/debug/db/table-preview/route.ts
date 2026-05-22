import "server-only";

/**
 * GET /api/debug/db/table-preview
 *
 * Read-only preview of rows from a whitelisted `sa.*` table.
 */
import { NextResponse } from "next/server";

import {
  getSaDebugTableMeta,
  isSaDebugTableName,
  parseSortParam,
  type SaDebugTableName,
} from "@/lib/debug/saTables";
import { buildTableRowSearchOrFilter } from "@/lib/debug/tableRowSearch";
import { resolvePreviewColumns } from "@/lib/debug/previewColumns";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;

export type DebugTablePreviewSuccess = {
  ok: true;
  table: string;
  limit: number;
  offset: number;
  search: string | null;
  columns: Array<{ name: string; dataType?: string }>;
  rows: Record<string, unknown>[];
};

export type DebugTablePreviewError = {
  ok: false;
  table?: string;
  limit?: number;
  offset?: number;
  search?: string | null;
  columns?: Array<{ name: string; dataType?: string }>;
  rows?: Record<string, unknown>[];
  error: string;
};

export type DebugTablePreviewResponse =
  | DebugTablePreviewSuccess
  | DebugTablePreviewError;

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

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "50", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value: string | null): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tableParam = url.searchParams.get("table") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));
  const sort = url.searchParams.get("sort");
  const searchRaw = url.searchParams.get("search");
  const search = searchRaw?.trim() ? searchRaw.trim() : null;

  if (!isSaDebugTableName(tableParam)) {
    const body: DebugTablePreviewError = {
      ok: false,
      error: `Unknown or unsupported table: ${tableParam || "(empty)"}`,
    };
    return NextResponse.json(body, { status: 400 });
  }

  const tableName = tableParam as SaDebugTableName;
  const meta = getSaDebugTableMeta(tableName);
  const { column, ascending } = parseSortParam(sort, tableName);

  try {
    const supabase = createServerClient();
    const rowSearchFilter = buildTableRowSearchOrFilter(meta.columns, search ?? "");

    let query = supabase.from(tableName).select("*");
    if (rowSearchFilter) {
      query = query.or(rowSearchFilter);
    }

    const { data, error } = await query
      .order(column, { ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const columns = resolvePreviewColumns(meta.columns, rows);

    const body: DebugTablePreviewSuccess = {
      ok: true,
      table: tableName,
      limit,
      offset,
      search,
      columns,
      rows,
    };
    return NextResponse.json(body);
  } catch (err) {
    const body: DebugTablePreviewError = {
      ok: false,
      table: tableName,
      limit,
      offset,
      search,
      columns: meta.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
      })),
      rows: [],
      error: extractErrorMessage(err),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
