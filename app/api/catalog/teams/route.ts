import "server-only";
import { NextResponse } from "next/server";

import {
  buildDepartmentTree,
  departmentsToFlatList,
} from "@/lib/org/departmentsCatalog";
import { loadAllDepartments } from "@/lib/org/repository";

export const dynamic = "force-dynamic";

/**
 * Wire-format types returned by `GET /api/catalog/teams`.
 *
 * Department ids are UUIDs from org `public.departments`.
 */
export type TeamFlat = {
  id: string;
  name: string;
  isActive: boolean;
};

export type TeamTreeNode = TeamFlat & {
  children: TeamTreeNode[];
};

type SuccessTreeBody = {
  ok: true;
  kind: "tree";
  nodes: TeamTreeNode[];
};

type SuccessFlatBody = {
  ok: true;
  kind: "flat";
  teams: TeamFlat[];
};

type ErrorBody = {
  ok: false;
  error: string;
};

export type TeamsCatalogResponse =
  | SuccessTreeBody
  | SuccessFlatBody
  | ErrorBody;

/**
 * `GET /api/catalog/teams`
 *
 * Loads the department tree from org Supabase (`public.departments`).
 * Returns a nested tree when parent links exist, otherwise a flat list.
 */
export async function GET() {
  try {
    const rows = await loadAllDepartments();
    const hasParentLinks = rows.some(
      (row) => row.parent_bitrix_department_id != null,
    );

    if (hasParentLinks) {
      const body: SuccessTreeBody = {
        ok: true,
        kind: "tree",
        nodes: buildDepartmentTree(rows),
      };
      return NextResponse.json(body);
    }

    const body: SuccessFlatBody = {
      ok: true,
      kind: "flat",
      teams: departmentsToFlatList(rows),
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const body: ErrorBody = { ok: false, error: message };
    return NextResponse.json(body, { status: 500 });
  }
}
