/**
 * Zod schemas for `POST /api/reports/drilldown`.
 *
 * Mirrors the shape declared in `features/reports/drilldown/types.ts`
 * and the contract documented in `ai_docs/03_REPORT_ENGINE.md`. The
 * schema lives in its own module so importing it doesn't pull `zod`
 * into bundles that only need TypeScript types.
 */
import { z } from "zod";

import { departmentIdSchema } from "@/lib/org/departmentId";
import { periodSchema, reportSlugSchema, dealScopeSchema } from "@/features/reports/engine/schema";

export const drilldownLevelSchema = z.enum([
  "product-groups",
  "managers",
  "deals",
]);

/**
 * `rowKey` must carry at least one of `managerId` / `productGroupId`.
 * Both can be present (e.g. drilling into deals for a specific
 * (manager, product-group) pair).
 */
const rowKeySchema = z
  .object({
    managerId: z.number().int().nonnegative().optional(),
    productGroupId: z.number().int().nonnegative().optional(),
  })
  .refine(
    (key) => key.managerId !== undefined || key.productGroupId !== undefined,
    {
      message: "rowKey must contain managerId and/or productGroupId",
    },
  );

export const drilldownRequestSchema = z.object({
  sectionSlug: z.literal("sales"),
  reportSlug: reportSlugSchema,
  rowKey: rowKeySchema,
  period: periodSchema,
  comparisonPeriod: periodSchema,
  filters: z.object({
    teamIds: z.array(departmentIdSchema()).optional(),
  }),
  level: drilldownLevelSchema,
  metricId: z.string().min(1).optional(),
  dealScope: dealScopeSchema.optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type DrilldownRequestParsed = z.infer<typeof drilldownRequestSchema>;
