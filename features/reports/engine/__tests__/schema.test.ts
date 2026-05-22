/**
 * Tests for `features/reports/engine/schema.ts` — the zod request body
 * schema for `POST /api/reports/run`.
 *
 * These exercise the validation rules documented in
 * `ai_docs/03_REPORT_ENGINE.md`:
 *   - `period` / `comparisonPeriod` are inclusive `yyyy-MM-dd` ranges
 *     where `from <= to` and both are parseable dates;
 *   - `comparisonPeriod` is required;
 *   - the worker chose the default zod object behavior (strip unknown
 *     keys) — tested explicitly so a future flip to `.strict()` or
 *     `.passthrough()` causes a deliberate test failure.
 */
import { describe, expect, it } from "vitest";

import {
  periodSchema,
  runReportRequestSchema,
} from "../schema";

const SAMPLE_DEPT_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

const validBody = () => ({
  sectionSlug: "sales" as const,
  reportSlug: "by-managers" as const,
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: { teamIds: [...SAMPLE_DEPT_IDS] },
  metricIds: ["all_core"],
  grouping: "none" as const,
});

describe("runReportRequestSchema — happy path", () => {
  it("parses a fully populated valid body", () => {
    const parsed = runReportRequestSchema.safeParse(validBody());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.period).toEqual({
        from: "2026-04-01",
        to: "2026-04-28",
      });
      expect(parsed.data.metricIds).toEqual(["all_core"]);
      expect(parsed.data.filters.teamIds).toEqual([...SAMPLE_DEPT_IDS]);
    }
  });

  it("accepts a body with empty filters object (teamIds optional)", () => {
    const body = { ...validBody(), filters: {} };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("accepts the by-product-groups slug", () => {
    const body = { ...validBody(), reportSlug: "by-product-groups" as const };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });
});

describe("runReportRequestSchema — period validation", () => {
  it("rejects period.from when not yyyy-MM-dd", () => {
    const body = {
      ...validBody(),
      period: { from: "April 1", to: "2026-04-28" },
    };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const path = parsed.error.issues.map((i) => i.path.join("."));
      expect(path.some((p) => p.startsWith("period.from"))).toBe(true);
    }
  });

  it("rejects period.to when not yyyy-MM-dd", () => {
    const body = {
      ...validBody(),
      period: { from: "2026-04-01", to: "28/04/2026" },
    };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });

  it("rejects when period.from is after period.to", () => {
    const body = {
      ...validBody(),
      period: { from: "2026-04-30", to: "2026-04-01" },
    };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => /from/.test(i.message))).toBe(true);
    }
  });

  it("rejects an unparseable date even when the regex matches", () => {
    // Numeric shape passes the regex but `2026-13-40` is not a real date.
    const body = {
      ...validBody(),
      period: { from: "2026-13-40", to: "2026-13-40" },
    };
    const parsed = periodSchema.safeParse(body.period);
    expect(parsed.success).toBe(false);
  });
});

describe("runReportRequestSchema — comparisonPeriod required", () => {
  it("rejects a body missing comparisonPeriod entirely", () => {
    const body = validBody() as Partial<ReturnType<typeof validBody>>;
    delete body.comparisonPeriod;
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.path.join(".").startsWith("comparisonPeriod"),
        ),
      ).toBe(true);
    }
  });

  it("rejects a body where comparisonPeriod.from is malformed", () => {
    const body = {
      ...validBody(),
      comparisonPeriod: { from: "bad", to: "2026-03-31" },
    };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });
});

describe("runReportRequestSchema — other field constraints", () => {
  it("rejects an empty metricIds array", () => {
    const body = { ...validBody(), metricIds: [] };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown grouping value", () => {
    const body = { ...validBody(), grouping: "weekly" as unknown as "none" };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-sales sectionSlug", () => {
    const body = { ...validBody(), sectionSlug: "marketing" as unknown as "sales" };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });

  it("rejects numeric teamIds (legacy Bitrix ids)", () => {
    const body = { ...validBody(), filters: { teamIds: [1, 2, 3] } };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(false);
  });
});

describe("runReportRequestSchema — extra fields", () => {
  it("strips unknown top-level keys (default zod 'strip' mode)", () => {
    // The worker did not call `.strict()` or `.passthrough()`, so zod's
    // default applies: unknown keys parse OK but are removed from the
    // output. Pin the behavior so a future flip is deliberate.
    const body = { ...validBody(), nonsense: "ignored" };
    const parsed = runReportRequestSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("nonsense" in parsed.data).toBe(false);
    }
  });
});
