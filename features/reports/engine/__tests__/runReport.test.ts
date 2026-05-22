// @vitest-environment node
/**
 * Integration tests for `features/reports/engine/runReport.ts`.
 *
 * The orchestrator wires:
 *   - `loadActiveMetrics(supabase)` — `sa.metrics`
 *   - `byManagers.fetch(...)` — `sa.daily_sales` + `sa.employees` + `sa.teams`
 *   - `byProductGroups.fetch(...)` — `sa.deals` + `sa.product_groups`
 *   - `mergeByDimension`, `applyGrouping`, `computeTotalsRow`
 *
 * The Supabase client is faked end-to-end. We dispatch on the table name
 * `from(...)` is called with and return a thenable builder so the
 * production code's chained calls (`.select(...).gte(...).lte(...).order(...)`,
 * `.select(...).in(...)`, etc.) all resolve to whatever the test wired up.
 *
 * Each test calls `clearMetricsCache()` so the metrics-catalog cache
 * doesn't leak across cases.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearMetricsCache, type MetricRow } from "../metricsCatalog";
import { runReport } from "../runReport";
import type { RunReportRequest } from "../types";

vi.mock("server-only", () => ({}));

const DEPT_ALPHA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";

const {
  loadManagerEmployeesByManagerIdsMock,
  loadDepartmentNamesByIdsMock,
  loadManagerEmployeeAliasesByManagerIdsMock,
  loadEmployeeAliasLookupsForManagersMock,
  resolveBitrixDepartmentIdsMock,
  resolveExpandedDepartmentFilterIdsMock,
} = vi.hoisted(() => ({
  loadManagerEmployeesByManagerIdsMock: vi.fn(),
  loadDepartmentNamesByIdsMock: vi.fn(),
  loadManagerEmployeeAliasesByManagerIdsMock: vi.fn(),
  loadEmployeeAliasLookupsForManagersMock: vi.fn(),
  resolveBitrixDepartmentIdsMock: vi.fn(),
  resolveExpandedDepartmentFilterIdsMock: vi.fn(),
}));

vi.mock("@/lib/org/repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/org/repository")>();
  return {
    ...actual,
    loadManagerEmployeesByManagerIds: loadManagerEmployeesByManagerIdsMock,
    loadDepartmentNamesByIds: loadDepartmentNamesByIdsMock,
    loadManagerEmployeeAliasesByManagerIds:
      loadManagerEmployeeAliasesByManagerIdsMock,
    loadEmployeeAliasLookupsForManagers:
      loadEmployeeAliasLookupsForManagersMock,
    resolveBitrixDepartmentIds: resolveBitrixDepartmentIdsMock,
    resolveExpandedDepartmentFilterIds: resolveExpandedDepartmentFilterIdsMock,
  };
});

function wireAliasLookups() {
  loadManagerEmployeeAliasesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.map((id) => ({
        id: id === 42 ? "42" : String(id),
        bitrix_id: id === 42 ? 1867 : id,
      })),
  );
  loadEmployeeAliasLookupsForManagersMock.mockImplementation(
    async (ids: number[]) => {
      const byBitrixId = new Map<
        number,
        { id: string; bitrix_id: number | null }
      >();
      const byId = new Map<string, { id: string; bitrix_id: number | null }>();
      for (const id of ids) {
        const row = {
          id: id === 42 ? "42" : String(id),
          bitrix_id: id === 42 ? 1867 : id,
        };
        byBitrixId.set(id, row);
        byId.set(row.id, row);
      }
      return { byBitrixId, byId };
    },
  );
}

function wireDefaultOrgLookups() {
  loadManagerEmployeesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.map((id) => {
        if (id === 1) {
          return {
            id: "emp-1",
            bitrix_id: 1,
            full_name: "Alice",
            team_id: DEPT_ALPHA,
          };
        }
        if (id === 2) {
          return {
            id: "emp-2",
            bitrix_id: 2,
            full_name: "Bob",
            team_id: DEPT_ALPHA,
          };
        }
        return {
          id: `emp-${id}`,
          bitrix_id: id,
          full_name: "",
          team_id: DEPT_ALPHA,
        };
      }),
  );
  loadDepartmentNamesByIdsMock.mockImplementation(async (ids: string[]) =>
    new Map(ids.map((id) => [id, "Alpha"])),
  );
  loadManagerEmployeeAliasesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.map((id) => ({
        id: String(id),
        bitrix_id: id,
      })),
  );
  loadEmployeeAliasLookupsForManagersMock.mockImplementation(
    async (ids: number[]) => {
      const byBitrixId = new Map<
        number,
        { id: string; bitrix_id: number | null }
      >();
      const byId = new Map<string, { id: string; bitrix_id: number | null }>();
      for (const id of ids) {
        const row = { id: String(id), bitrix_id: id };
        byBitrixId.set(id, row);
        byId.set(row.id, row);
      }
      return { byBitrixId, byId };
    },
  );
  resolveBitrixDepartmentIdsMock.mockResolvedValue([]);
  resolveExpandedDepartmentFilterIdsMock.mockImplementation(async (ids) => [
    ...ids,
  ]);
}

type Result = { data: unknown; error: unknown };

/**
 * A thenable Supabase query-builder stub.
 *
 * Production code chains `.select().gte().lte().order().in()` and then
 * awaits the final value, so the builder must (a) return itself from
 * every chain method and (b) be `await`-able. We expose `.then` to
 * implement the latter without creating a real Promise per chain
 * method (which would lose the chainability).
 */
function makeBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    neq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    gt: (...args: unknown[]) => Builder;
    lt: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    or: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    limit: (...args: unknown[]) => Builder;
    then: PromiseLike<Result>["then"];
    __calls: Record<string, unknown[][]>;
  };
  const builder = {} as Builder;
  for (const m of [
    "select",
    "eq",
    "neq",
    "gte",
    "lte",
    "gt",
    "lt",
    "in",
    "or",
    "order",
    "limit",
  ] as const) {
    builder[m] = ((...args: unknown[]) => {
      calls[m] = calls[m] ?? [];
      calls[m].push(args);
      return builder;
    }) as Builder[typeof m];
  }
  builder.then = ((onFulfilled, onRejected) =>
    Promise.resolve(result).then(
      onFulfilled,
      onRejected,
    )) as Builder["then"];
  builder.__calls = calls;
  return builder;
}

function makeFilteringDealsBuilder(
  allDeals: Array<Record<string, unknown>>,
) {
  let dealIdFilter: number[] | null = null;

  const builder = makeBuilder({ data: [], error: null });
  const origIn = builder.in;
  builder.in = ((column: unknown, values: unknown) => {
    if (column === "deal_id") dealIdFilter = values as number[];
    return origIn(column, values);
  }) as typeof builder.in;

  builder.then = ((onFulfilled, onRejected) => {
    let rows = allDeals;
    if (dealIdFilter) {
      const allowed = new Set(dealIdFilter);
      rows = rows.filter((row) => allowed.has(Number(row.deal_id)));
    }
    return Promise.resolve({ data: rows, error: null }).then(
      onFulfilled,
      onRejected,
    );
  }) as typeof builder.then;

  return builder;
}

const REPEAT_FUNNEL_ID = 2;
const PRIMARY_FUNNEL_ID = 1;

function makePeriodDealsBuilder(
  dealsByPeriodFrom: Record<
    string,
    Array<{ deal_id: number; current_manager_id: number; funnel_id?: number }>
  >,
) {
  type Builder = {
    select: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    gte: (_col: string, from: string) => Builder;
    lt: (_col: string, to: string) => Builder;
    then: PromiseLike<Result>["then"];
    __periodFrom: string;
    __periodToExclusive: string;
  };
  const builder = {} as Builder;
  builder.__periodFrom = "";
  builder.__periodToExclusive = "";
  builder.select = () => builder;
  builder.in = () => builder;
  builder.gte = (_col, from) => {
    builder.__periodFrom = from.slice(0, 10);
    return builder;
  };
  builder.lt = (_col, to) => {
    builder.__periodToExclusive = to.slice(0, 10);
    return builder;
  };
  builder.then = ((onFulfilled, onRejected) => {
    const rows = (dealsByPeriodFrom[builder.__periodFrom] ?? []).filter(
      (deal) => (deal.funnel_id ?? PRIMARY_FUNNEL_ID) !== REPEAT_FUNNEL_ID,
    );
    return Promise.resolve({ data: rows, error: null }).then(
      onFulfilled,
      onRejected,
    );
  }) as Builder["then"];
  return builder;
}

function wirePrimaryDealsTables(
  table: string,
  dealsByPeriod: Record<
    string,
    Array<{ deal_id: number; current_manager_id: number; funnel_id?: number }>
  >,
): ReturnType<typeof makeBuilder> | ReturnType<typeof makePeriodDealsBuilder> | null {
  if (table === "funnels") {
    return makeBuilder({ data: [{ id: REPEAT_FUNNEL_ID }], error: null });
  }
  if (table === "deals") {
    return makePeriodDealsBuilder(dealsByPeriod);
  }
  return null;
}

function metric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "x",
    name_ru: "X",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "decimal",
    aggregation: null,
    source: null,
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: null,
    sort_order: 0,
    is_core: true,
    is_active: true,
    created_at: null,
    ...overrides,
  };
}

const baseRequest = (
  overrides: Partial<RunReportRequest> = {},
): RunReportRequest => ({
  sectionSlug: "sales",
  reportSlug: "by-managers",
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: { teamIds: [] },
  metricIds: ["incoming_deals_count"],
  grouping: "none",
  ...overrides,
});

beforeEach(() => {
  clearMetricsCache();
  wireDefaultOrgLookups();
});

afterEach(() => {
  clearMetricsCache();
});

describe("runReport — by-managers, grouping='none'", () => {
  it("returns a complete response with columns, rows, totals, meta", async () => {
    const catalog: MetricRow[] = [
      metric({
        id: "incoming_deals_count",
        name_ru: "Входящие сделки",
        data_type: "int",
        source_column: "incoming_deals_count",
        is_core: true,
        sort_order: 0,
      }),
    ];

    // Two managers (1, 2) under one team (10) with daily rows in the
    // current period, and a single previous-period row for manager 1.
    const dailyRowsCurrent = [
      {
        id: 1,
        report_date: "2026-04-05",
        team_id: 10,
        manager_id: 1,
        incoming_deals_count: 3,
        called_deals_count: 0,
        reservations_count: 0,
        primary_sales_count: 0,
        primary_sales_amount: 0,
        repeat_sales_amount: 0,
        primary_shipments_count: 0,
        primary_shipments_amount: 0,
        repeat_shipments_amount: 0,
        ppp_count: 0,
        ppp_amount: 0,
        confirmed_reservations_count: 0,
        repeat_sales_count: 0,
      },
      {
        id: 2,
        report_date: "2026-04-10",
        team_id: 10,
        manager_id: 1,
        incoming_deals_count: 4,
        called_deals_count: 0,
        reservations_count: 0,
        primary_sales_count: 0,
        primary_sales_amount: 0,
        repeat_sales_amount: 0,
        primary_shipments_count: 0,
        primary_shipments_amount: 0,
        repeat_shipments_amount: 0,
        ppp_count: 0,
        ppp_amount: 0,
        confirmed_reservations_count: 0,
        repeat_sales_count: 0,
      },
      {
        id: 3,
        report_date: "2026-04-12",
        team_id: 10,
        manager_id: 2,
        incoming_deals_count: 5,
        called_deals_count: 0,
        reservations_count: 0,
        primary_sales_count: 0,
        primary_sales_amount: 0,
        repeat_sales_amount: 0,
        primary_shipments_count: 0,
        primary_shipments_amount: 0,
        repeat_shipments_amount: 0,
        ppp_count: 0,
        ppp_amount: 0,
        confirmed_reservations_count: 0,
        repeat_sales_count: 0,
      },
    ];
    const dailyRowsPrevious = [
      {
        id: 4,
        report_date: "2026-03-15",
        team_id: 10,
        manager_id: 1,
        incoming_deals_count: 2,
        called_deals_count: 0,
        reservations_count: 0,
        primary_sales_count: 0,
        primary_sales_amount: 0,
        repeat_sales_amount: 0,
        primary_shipments_count: 0,
        primary_shipments_amount: 0,
        repeat_shipments_amount: 0,
        ppp_count: 0,
        ppp_amount: 0,
        confirmed_reservations_count: 0,
        repeat_sales_count: 0,
      },
    ];

    // The orchestrator runs current + comparison via Promise.all, so
    // both calls hit `from('daily_sales')`. We need to alternate the
    // returned data: first call → current, second call → previous.
    const dailyResults: Result[] = [
      { data: dailyRowsCurrent, error: null },
      { data: dailyRowsPrevious, error: null },
    ];
    let dailyCall = 0;

    // Org employee / department labels are mocked via `@/lib/org/repository`.
    const primaryDealsByPeriod = {
      "2026-04-01": [
        ...Array.from({ length: 7 }, (_, index) => ({
          deal_id: index + 1,
          current_manager_id: 1,
          funnel_id: PRIMARY_FUNNEL_ID,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          deal_id: index + 8,
          current_manager_id: 2,
          funnel_id: PRIMARY_FUNNEL_ID,
        })),
      ],
      "2026-03-04": [
        { deal_id: 101, current_manager_id: 1, funnel_id: PRIMARY_FUNNEL_ID },
        { deal_id: 102, current_manager_id: 1, funnel_id: PRIMARY_FUNNEL_ID },
      ],
    };

    const fromMock = vi.fn((table: string) => {
      const primary = wirePrimaryDealsTables(table, primaryDealsByPeriod);
      if (primary) return primary;
      if (table === "metrics") {
        return makeBuilder({ data: catalog, error: null });
      }
      if (table === "daily_sales") {
        const result = dailyResults[dailyCall] ?? dailyResults[0];
        dailyCall += 1;
        return makeBuilder(result);
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const supabase = { from: fromMock };

    const res = await runReport(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
    );

    // --- shape ---
    expect(res).toMatchObject({
      meta: {
        period: { from: "2026-04-01", to: "2026-04-28" },
        comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
      },
    });
    expect(res.columns.dimension.map((d) => d.key)).toEqual([
      "manager_name",
      "team_name",
    ]);
    expect(res.columns.metrics.map((m) => m.id)).toEqual([
      "incoming_deals_count",
    ]);

    // --- rows ---
    expect(res.rows).toHaveLength(2);
    const alice = res.rows.find(
      (r) => r.dimension.manager_name === "Alice",
    )!;
    expect(alice).toBeDefined();
    expect(alice.dimension.team_name).toBe("Alpha");
    expect(alice.metrics.incoming_deals_count.current).toBe(7); // 3 + 4
    expect(alice.metrics.incoming_deals_count.previous).toBe(2);
    expect(alice.metrics.incoming_deals_count.delta).toBe(5);
    expect(alice.metrics.incoming_deals_count.deltaPercent).toBeCloseTo(250, 6);

    const bob = res.rows.find((r) => r.dimension.manager_name === "Bob")!;
    expect(bob.metrics.incoming_deals_count.current).toBe(5);
    // Spec — ai_docs/03_REPORT_ENGINE.md: a manager who appears only
    // in the current period gets `previous: 0`, with a real delta;
    // `deltaPercent` is null because the previous-period base is 0.
    expect(bob.metrics.incoming_deals_count.previous).toBe(0);
    expect(bob.metrics.incoming_deals_count.delta).toBe(5);
    expect(bob.metrics.incoming_deals_count.deltaPercent).toBeNull();

    // --- totals (grouping !== 'total' ⇒ totals row populated) ---
    expect(res.totals).not.toBeNull();
    expect(res.totals!.metrics.incoming_deals_count.current).toBe(12); // 7 + 5
    expect(res.totals!.metrics.incoming_deals_count.previous).toBe(2);
  });
});

describe("runReport — by-managers, grouping='total'", () => {
  it("returns a single totals-only row and totals=null per the contract", async () => {
    const catalog: MetricRow[] = [
      metric({
        id: "incoming_deals_count",
        source_column: "incoming_deals_count",
        is_core: true,
      }),
    ];

    const dailyCurrent = [
      {
        id: 1,
        report_date: "2026-04-05",
        team_id: 10,
        manager_id: 1,
        incoming_deals_count: 3,
        called_deals_count: 0,
        reservations_count: 0,
        primary_sales_count: 0,
        primary_sales_amount: 0,
        repeat_sales_amount: 0,
        primary_shipments_count: 0,
        primary_shipments_amount: 0,
        repeat_shipments_amount: 0,
        ppp_count: 0,
        ppp_amount: 0,
        confirmed_reservations_count: 0,
        repeat_sales_count: 0,
      },
    ];

    const dailyResults: Result[] = [
      { data: dailyCurrent, error: null },
      { data: [], error: null },
    ];
    let dailyCall = 0;

    const primaryDealsByPeriod = {
      "2026-04-01": [
        { deal_id: 1, current_manager_id: 1, funnel_id: PRIMARY_FUNNEL_ID },
        { deal_id: 2, current_manager_id: 1, funnel_id: PRIMARY_FUNNEL_ID },
        { deal_id: 3, current_manager_id: 1, funnel_id: PRIMARY_FUNNEL_ID },
      ],
      "2026-03-04": [],
    };

    const fromMock = vi.fn((table: string) => {
      const primary = wirePrimaryDealsTables(table, primaryDealsByPeriod);
      if (primary) return primary;
      if (table === "metrics") {
        return makeBuilder({ data: catalog, error: null });
      }
      if (table === "daily_sales") {
        const result = dailyResults[dailyCall] ?? dailyResults[0];
        dailyCall += 1;
        return makeBuilder(result);
      }
      // `by-managers` prefers `daily_sales` but falls back to `deals`
      // when a period returns no daily rows (or the table is unavailable).
      if (table === "deals") {
        return makeBuilder({ data: [], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runReport(
      baseRequest({ grouping: "total" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.totals).toBeNull();
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].key).toBe("__totals__");
    expect(res.rows[0].dimension).toEqual({});
    expect(res.rows[0].metrics.incoming_deals_count.current).toBe(3);
  });
});

describe("runReport — by-managers, metricIds='all_core'", () => {
  it("filters columns.metrics to only is_core=true entries", async () => {
    const catalog: MetricRow[] = [
      metric({
        id: "incoming_deals_count",
        source_column: "incoming_deals_count",
        is_core: true,
        sort_order: 0,
      }),
      metric({
        id: "called_deals_count",
        source_column: "called_deals_count",
        is_core: false,
        sort_order: 1,
      }),
      metric({
        id: "reservations_count",
        source_column: "reservations_count",
        is_core: true,
        sort_order: 2,
      }),
    ];

    const dailyResults: Result[] = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    let dailyCall = 0;

    const fromMock = vi.fn((table: string) => {
      const primary = wirePrimaryDealsTables(table, {
        "2026-04-01": [],
        "2026-03-04": [],
      });
      if (primary) return primary;
      if (table === "metrics") {
        return makeBuilder({ data: catalog, error: null });
      }
      if (table === "daily_sales") {
        const result = dailyResults[dailyCall] ?? dailyResults[0];
        dailyCall += 1;
        return makeBuilder(result);
      }
      if (table === "deals") {
        return makeBuilder({ data: [], error: null });
      }
      if (table === "stages") {
        return makeBuilder({ data: [], error: null });
      }
      if (table === "deal_events") {
        return makeBuilder({ data: [], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runReport(
      baseRequest({ metricIds: ["all_core"] }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.columns.metrics.map((m) => m.id)).toEqual([
      "incoming_deals_count",
      "reservations_count",
    ]);
  });
});

describe("runReport — by-product-groups", () => {
  it("uses the synthetic deals_count + deals_amount metric set and aggregates sa.deals", async () => {
    // The catalog is irrelevant for this report (the dimension uses a
    // fixed synthetic metric set), but `loadActiveMetrics` is still
    // called.
    const catalog: MetricRow[] = [];

    const dealsCurrent = [
      {
        deal_id: 100,
        product_group_id: 1,
        amount: 1000,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
      },
      {
        deal_id: 101,
        product_group_id: 1,
        amount: 500,
        team_id: 10,
        created_at: "2026-04-06T10:00:00Z",
      },
      {
        deal_id: 102,
        product_group_id: 2,
        amount: 700,
        team_id: 10,
        created_at: "2026-04-07T10:00:00Z",
      },
    ];
    const dealsPrevious = [
      {
        deal_id: 200,
        product_group_id: 1,
        amount: 600,
        team_id: 10,
        created_at: "2026-03-15T10:00:00Z",
      },
    ];

    const dealsResults: Result[] = [
      { data: dealsCurrent, error: null },
      { data: dealsPrevious, error: null },
    ];
    let dealsCall = 0;

    const productGroupsData = [
      { id: 1, name: "Group A" },
      { id: 2, name: "Group B" },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "metrics") {
        return makeBuilder({ data: catalog, error: null });
      }
      if (table === "deals") {
        const result = dealsResults[dealsCall] ?? dealsResults[0];
        dealsCall += 1;
        return makeBuilder(result);
      }
      if (table === "product_groups") {
        return makeBuilder({ data: productGroupsData, error: null });
      }
      if (table === "funnels") {
        return makeBuilder({ data: [], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runReport(
      baseRequest({
        reportSlug: "by-product-groups",
        metricIds: ["whatever"], // ignored for this report
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.columns.dimension.map((d) => d.key)).toEqual([
      "product_group_name",
    ]);
    const metricIds = res.columns.metrics.map((m) => m.id).sort();
    expect(metricIds).toEqual(["deals_amount", "deals_count"]);

    expect(res.rows).toHaveLength(2);

    const groupA = res.rows.find(
      (r) => r.dimension.product_group_name === "Group A",
    )!;
    expect(groupA).toBeDefined();
    expect(groupA.metrics.deals_count.current).toBe(2);
    expect(groupA.metrics.deals_amount.current).toBe(1500);
    expect(groupA.metrics.deals_count.previous).toBe(1);
    expect(groupA.metrics.deals_amount.previous).toBe(600);

    const groupB = res.rows.find(
      (r) => r.dimension.product_group_name === "Group B",
    )!;
    expect(groupB.metrics.deals_count.current).toBe(1);
    expect(groupB.metrics.deals_amount.current).toBe(700);
    // Spec — ai_docs/03_REPORT_ENGINE.md: product group present only
    // in the current period → previous side reports 0, with proper
    // delta. `deltaPercent` is null because the base is 0.
    expect(groupB.metrics.deals_count.previous).toBe(0);
    expect(groupB.metrics.deals_count.delta).toBe(1);
    expect(groupB.metrics.deals_count.deltaPercent).toBeNull();
    expect(groupB.metrics.deals_amount.previous).toBe(0);
    expect(groupB.metrics.deals_amount.delta).toBe(700);
  });
});
