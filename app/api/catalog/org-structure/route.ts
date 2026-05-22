import "server-only";
import { NextResponse } from "next/server";

import { buildOrgStructure } from "@/lib/org/orgStructureCatalog";
import { loadAllDepartments, loadAllEmployees } from "@/lib/org/repository";

export const dynamic = "force-dynamic";

export type OrgStructureApiResponse =
  | ({ ok: true } & ReturnType<typeof buildOrgStructure>)
  | { ok: false; error: string };

/**
 * `GET /api/catalog/org-structure`
 *
 * Read-only org tree: departments with nested employees (from org DB).
 */
export async function GET() {
  try {
    const [departments, employees] = await Promise.all([
      loadAllDepartments(),
      loadAllEmployees(),
    ]);

    const body: OrgStructureApiResponse = {
      ok: true,
      ...buildOrgStructure(departments, employees),
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { ok: false, error: message } satisfies OrgStructureApiResponse,
      { status: 500 },
    );
  }
}
