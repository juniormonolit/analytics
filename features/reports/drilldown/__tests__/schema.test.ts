/**
 * Tests for `features/reports/drilldown/schema.ts` — the zod request
 * body schema for `POST /api/reports/drilldown`.
 *
 * Validation rules mirror `ai_docs/03_REPORT_ENGINE.md`:
 *   - `sectionSlug` is the literal `"sales"`;
 *   - `reportSlug` is one of `by-managers` / `by-product-groups`;
 *   - `level` is one of `product-groups` / `managers` / `deals`;
 *   - `rowKey` must carry at least one of `managerId` / `productGroupId`;
 *   - `period` / `comparisonPeriod` follow the engine's date-range rules;
 *   - `limit` / `offset` are optional with no default applied at the
 *     schema layer (defaults live in the deals-level handler instead).
 */
import { describe, expect, it } from "vitest";

import { drilldownRequestSchema } from "../schema";

const SAMPLE_DEPT_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

const validBody = () => ({
  sectionSlug: "sales" as const,
  reportSlug: "by-managers" as const,
  rowKey: { managerId: 123 },
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: { teamIds: [...SAMPLE_DEPT_IDS] },
  level: "product-groups" as const,
});

describe("drilldownRequestSchema — happy paths per (reportSlug, level, rowKey)", () => {
  it("accepts by-managers + level=product-groups + rowKey.managerId", () => {
    const parsed = drilldownRequestSchema.safeParse(validBody());
    expect(parsed.success).toBe(true);
  });

  it("accepts by-managers + level=deals + rowKey.managerId", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts by-product-groups + level=managers + rowKey.productGroupId", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      reportSlug: "by-product-groups",
      level: "managers",
      rowKey: { productGroupId: 7 },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts by-product-groups + level=deals + rowKey.productGroupId", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      reportSlug: "by-product-groups",
      level: "deals",
      rowKey: { productGroupId: 7 },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a rowKey with both managerId AND productGroupId (combined drill)", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
      rowKey: { managerId: 1, productGroupId: 2 },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty filters object (teamIds optional)", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      filters: {},
    });
    expect(parsed.success).toBe(true);
  });
});

describe("drilldownRequestSchema — rowKey validation", () => {
  it("rejects when rowKey carries neither managerId nor productGroupId", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      rowKey: {},
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          /managerId/.test(i.message) || /productGroupId/.test(i.message),
        ),
      ).toBe(true);
    }
  });

  it("rejects negative managerId (nonnegative int)", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      rowKey: { managerId: -1 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-integer productGroupId", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      rowKey: { productGroupId: 1.5 },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("drilldownRequestSchema — enum validation", () => {
  it("rejects an unknown level value", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "teams" as unknown as "deals",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("level"))).toBe(
        true,
      );
    }
  });

  it("rejects an unknown reportSlug", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      reportSlug: "by-teams" as unknown as "by-managers",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-sales sectionSlug", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      sectionSlug: "marketing" as unknown as "sales",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("drilldownRequestSchema — period validation", () => {
  it("rejects period.from when not yyyy-MM-dd", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      period: { from: "April 1", to: "2026-04-28" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when period.from is after period.to", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      period: { from: "2026-04-30", to: "2026-04-01" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when comparisonPeriod is missing", () => {
    const body = validBody() as Partial<ReturnType<typeof validBody>>;
    delete body.comparisonPeriod;
    const parsed = drilldownRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });
});

describe("drilldownRequestSchema — pagination fields", () => {
  it("treats limit and offset as optional (no schema-level defaults applied)", () => {
    const parsed = drilldownRequestSchema.safeParse(validBody());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Pin the worker's choice: defaults live in the deals-level
      // handler, so a missing field stays missing after parsing.
      expect(parsed.data.limit).toBeUndefined();
      expect(parsed.data.offset).toBeUndefined();
    }
  });

  it("accepts an explicit limit and offset within bounds", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
      limit: 50,
      offset: 100,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(50);
      expect(parsed.data.offset).toBe(100);
    }
  });

  it("rejects limit > 1000", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
      limit: 5000,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a negative offset", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
      offset: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-positive limit", () => {
    const parsed = drilldownRequestSchema.safeParse({
      ...validBody(),
      level: "deals",
      limit: 0,
    });
    expect(parsed.success).toBe(false);
  });
});
