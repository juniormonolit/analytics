/**
 * Type-level tests for the curated row aliases in `lib/supabase/types.ts`.
 *
 * `expectTypeOf(...)` is a no-op at runtime — its assertions are checked by
 * the TypeScript compiler when vitest evaluates the file. We add one small
 * runtime `expect` per test so the test runner counts each case (and so a
 * type-check regression surfaces as a failed-to-compile test file rather
 * than zero-run tests).
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  DailySales,
  Deal,
  DealEvent,
  Employee,
  Funnel,
  Json,
  Metric,
  ProductGroup,
  ReportConfig,
  Stage,
  Tables,
  TablesInsert,
  TablesUpdate,
  Team,
} from "../types";

describe("Tables<T> — row types", () => {
  it("deals.deal_id is `number` (PK is non-null)", () => {
    expectTypeOf<Tables<"deals">["deal_id"]>().toEqualTypeOf<number>();
    expect(true).toBe(true);
  });

  it("deals.created_at is `string` (timestamptz, NOT NULL with default)", () => {
    expectTypeOf<Tables<"deals">["created_at"]>().toEqualTypeOf<string>();
    expect(true).toBe(true);
  });

  it("deals.product_group_id is `number | null` (nullable FK)", () => {
    expectTypeOf<
      Tables<"deals">["product_group_id"]
    >().toEqualTypeOf<number | null>();
    expect(true).toBe(true);
  });

  it("metrics.dependencies is `string[] | null` (text[] column)", () => {
    expectTypeOf<
      Tables<"metrics">["dependencies"]
    >().toEqualTypeOf<string[] | null>();
    expect(true).toBe(true);
  });

  it("metrics.color_rules is `Json | null` (jsonb column)", () => {
    expectTypeOf<
      Tables<"metrics">["color_rules"]
    >().toEqualTypeOf<Json | null>();
    expect(true).toBe(true);
  });
});

describe("TablesInsert<T> — insert payloads", () => {
  it("deals insert payload exposes a `deal_id` property", () => {
    // We avoid asserting required-ness directly (toMatchTypeOf is brittle
    // around `?` modifiers); just guarantee the property is reachable.
    expectTypeOf<TablesInsert<"deals">>().toHaveProperty("deal_id");
    expect(true).toBe(true);
  });

  it("deals.deal_id on insert is plain `number` (no DEFAULT in the schema)", () => {
    expectTypeOf<TablesInsert<"deals">["deal_id"]>().toEqualTypeOf<number>();
    expect(true).toBe(true);
  });

  it("teams.id on insert is optional (sequence default, so `number | undefined`)", () => {
    expectTypeOf<TablesInsert<"teams">["id"]>().toEqualTypeOf<
      number | undefined
    >();
    expect(true).toBe(true);
  });
});

describe("TablesUpdate<T> — partial update payloads", () => {
  it("deals.deal_id on update is optional", () => {
    expectTypeOf<TablesUpdate<"deals">["deal_id"]>().toEqualTypeOf<
      number | undefined
    >();
    expect(true).toBe(true);
  });

  it("deals.product_group_id on update accepts null", () => {
    // Nullable column → on update we accept `number | null | undefined`.
    expectTypeOf<TablesUpdate<"deals">["product_group_id"]>().toEqualTypeOf<
      number | null | undefined
    >();
    expect(true).toBe(true);
  });
});

describe("named row aliases re-exported from types.ts", () => {
  it("Deal alias matches Tables<\"deals\">", () => {
    expectTypeOf<Deal>().toEqualTypeOf<Tables<"deals">>();
    expect(true).toBe(true);
  });

  it("DealEvent alias matches Tables<\"deal_events\">", () => {
    expectTypeOf<DealEvent>().toEqualTypeOf<Tables<"deal_events">>();
    expect(true).toBe(true);
  });

  it("Team alias matches Tables<\"teams\">", () => {
    expectTypeOf<Team>().toEqualTypeOf<Tables<"teams">>();
    expect(true).toBe(true);
  });

  it("Employee alias matches Tables<\"employees\">", () => {
    expectTypeOf<Employee>().toEqualTypeOf<Tables<"employees">>();
    expect(true).toBe(true);
  });

  it("ProductGroup alias matches Tables<\"product_groups\">", () => {
    expectTypeOf<ProductGroup>().toEqualTypeOf<Tables<"product_groups">>();
    expect(true).toBe(true);
  });

  it("Metric alias matches Tables<\"metrics\">", () => {
    expectTypeOf<Metric>().toEqualTypeOf<Tables<"metrics">>();
    expect(true).toBe(true);
  });

  it("ReportConfig alias matches Tables<\"report_configs\">", () => {
    expectTypeOf<ReportConfig>().toEqualTypeOf<Tables<"report_configs">>();
    expect(true).toBe(true);
  });

  it("Stage alias matches Tables<\"stages\">", () => {
    expectTypeOf<Stage>().toEqualTypeOf<Tables<"stages">>();
    expect(true).toBe(true);
  });

  it("Funnel alias matches Tables<\"funnels\">", () => {
    expectTypeOf<Funnel>().toEqualTypeOf<Tables<"funnels">>();
    expect(true).toBe(true);
  });

  it("DailySales alias matches Tables<\"daily_sales\">", () => {
    expectTypeOf<DailySales>().toEqualTypeOf<Tables<"daily_sales">>();
    expect(true).toBe(true);
  });
});
