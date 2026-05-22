/**
 * Zod schemas validating the JSON body of `POST /api/reports/run`.
 *
 * Validation rules mirror `ai_docs/03_REPORT_ENGINE.md` exactly:
 * - `period` / `comparisonPeriod` are inclusive `yyyy-MM-dd` ranges.
 * - `metricIds` must be a non-empty array of strings (or the single
 *   token `"all_core"`) — the engine resolves that token after
 *   validation by looking up the catalog.
 * - `filters.teamIds` is optional; an empty/missing list means "no
 *   department filter". Values are org `departments.id` UUID strings.
 *
 * All schemas live in this file (rather than next to `types.ts`) so
 * importing them does not pull `zod` into bundles that only need the
 * public TypeScript types.
 */
import { z } from "zod";

import { departmentIdSchema } from "@/lib/org/departmentId";

/** Anchored `yyyy-MM-dd` matcher — same shape used by `lib/period`. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const periodSchema = z
  .object({
    from: z.string().regex(ISO_DATE_RE, "from must be yyyy-MM-dd"),
    to: z.string().regex(ISO_DATE_RE, "to must be yyyy-MM-dd"),
  })
  .refine(
    (p) => !Number.isNaN(Date.parse(p.from)) && !Number.isNaN(Date.parse(p.to)),
    { message: "period contains an unparseable date" },
  )
  // ISO `yyyy-MM-dd` is lexicographically comparable, so a plain string
  // comparison is the simplest correct check for "from <= to".
  .refine((p) => p.from <= p.to, { message: "from must be <= to" });

export const reportSlugSchema = z.enum(["by-managers", "by-product-groups"]);
export const groupingSchema = z.enum(["none", "team", "total"]);
export const dealScopeSchema = z.enum(["primary", "repeat", "all"]);

export const runReportRequestSchema = z.object({
  sectionSlug: z.literal("sales"),
  reportSlug: reportSlugSchema,
  period: periodSchema,
  comparisonPeriod: periodSchema,
  filters: z.object({
    teamIds: z.array(departmentIdSchema()).optional(),
  }),
  metricIds: z.array(z.string().min(1)).min(1),
  grouping: groupingSchema,
  dealScope: dealScopeSchema.optional(),
  uiHiddenMetricIds: z.array(z.string().min(1)).optional(),
});

export type RunReportRequestParsed = z.infer<typeof runReportRequestSchema>;
