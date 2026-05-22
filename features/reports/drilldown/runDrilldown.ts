import "server-only";

/**
 * Top-level orchestrator for `POST /api/reports/drilldown`.
 *
 * Routes the validated request to the right level handler based on
 * `(reportSlug, level)`. Keeping this dispatch in one place means the
 * route handler stays trivial and the level files don't need to know
 * about each other.
 *
 * Routing matrix:
 *
 *   reportSlug=by-managers
 *     level=product-groups → productGroups handler
 *     level=deals          → deals handler (filtered by managerId)
 *
 *   reportSlug=by-product-groups
 *     level=managers       → managers handler
 *     level=deals          → deals handler (filtered by productGroupId)
 *
 *   level=managers under by-managers OR
 *   level=product-groups under by-product-groups → invalid (a row in
 *     `by-managers` already represents a manager; drilling further
 *     means going down to product-groups or deals).
 */
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { resolveExpandedDepartmentFilterIds } from "@/lib/org/repository";

import { runDealsLevel } from "./levels/deals";
import { runManagersLevel } from "./levels/managers";
import { runProductGroupsLevel } from "./levels/productGroups";
import type { DrilldownAggregateResponse, DrilldownDealsResponse, DrilldownRequest } from "./types";

export async function runDrilldown(
  request: DrilldownRequest,
  supabase: ServerSupabaseClient,
): Promise<DrilldownAggregateResponse | DrilldownDealsResponse> {
  let normalizedRequest = request;
  const selectedTeamIds = request.filters.teamIds;
  if (selectedTeamIds && selectedTeamIds.length > 0) {
    const expanded = await resolveExpandedDepartmentFilterIds(selectedTeamIds);
    normalizedRequest = {
      ...request,
      filters: { ...request.filters, teamIds: expanded },
    };
  }

  if (normalizedRequest.level === "deals") {
    return runDealsLevel(normalizedRequest, supabase);
  }

  if (normalizedRequest.reportSlug === "by-managers") {
    if (normalizedRequest.level === "product-groups") {
      return runProductGroupsLevel(normalizedRequest, supabase);
    }
    throw new Error(
      `Invalid level "${normalizedRequest.level}" for reportSlug "by-managers"`,
    );
  }

  // reportSlug === "by-product-groups"
  if (normalizedRequest.level === "managers") {
    return runManagersLevel(normalizedRequest, supabase);
  }
  throw new Error(
    `Invalid level "${normalizedRequest.level}" for reportSlug "by-product-groups"`,
  );
}
