// @vitest-environment node
/**
 * Tests for the three drill-down level handlers
 * (`features/reports/drilldown/levels/*.ts`).
 *
 * The handlers all use the same Supabase chained-builder pattern
 * (`supabase.from(table).select(...).eq(...).gte(...).lt(...)...`),
 * so we reuse a thenable-builder stub very similar to the one in
 * `features/reports/engine/__tests__/runReport.test.ts`. The mock
 * tracks every chained method call and returns `{ data, error, count }`
 * when awaited, which covers the deals-level handler's
 * `select(..., { count: "exact" })` requirement.
 *
 * `server-only` is stubbed because Vitest doesn't apply Next.js's
 * `react-server` resolution condition; the build-time guarantee is
 * enforced by the bundler, not this test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runDealsLevel } from "../deals";
import { runManagersLevel } from "../managers";
import { runProductGroupsLevel } from "../productGroups";
import type { DrilldownRequest } from "../../types";

vi.mock("server-only", () => ({}));

const DEPT_ALPHA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
const DEPT_BETA = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const {
  loadManagerEmployeesByManagerIdsMock,
  loadDepartmentNamesByIdsMock,
  resolveManagerIdAliasesFromOrgMock,
} = vi.hoisted(() => ({
  loadManagerEmployeesByManagerIdsMock: vi.fn(),
  loadDepartmentNamesByIdsMock: vi.fn(),
  resolveManagerIdAliasesFromOrgMock: vi.fn(),
}));

vi.mock("@/lib/org/repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/org/repository")>();
  return {
    ...actual,
    loadManagerEmployeesByManagerIds: loadManagerEmployeesByManagerIdsMock,
    loadDepartmentNamesByIds: loadDepartmentNamesByIdsMock,
    resolveManagerIdAliasesFromOrg: resolveManagerIdAliasesFromOrgMock,
  };
});

function wireManagersOrgLookups() {
  resolveManagerIdAliasesFromOrgMock.mockImplementation(async (id: number) => [
    id,
  ]);
  loadManagerEmployeesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.flatMap((id) => {
        if (id === 1) {
          return [
            {
              id: "emp-1",
              bitrix_id: 1,
              full_name: "Alice",
              team_id: DEPT_ALPHA,
            },
          ];
        }
        if (id === 2) {
          return [
            {
              id: "emp-2",
              bitrix_id: 2,
              full_name: "Bob",
              team_id: DEPT_BETA,
            },
          ];
        }
        return [];
      }),
  );
  loadDepartmentNamesByIdsMock.mockImplementation(async (ids: string[]) =>
    new Map(
      ids.map((id) => [
        id,
        id === DEPT_ALPHA ? "Alpha" : id === DEPT_BETA ? "Beta" : "",
      ]),
    ),
  );
}

// ---------------------------------------------------------------------------
// Supabase builder stub
// ---------------------------------------------------------------------------

type Result = { data: unknown; error: unknown; count?: number | null };

/**
 * A thenable Supabase query-builder stub. Every chain method records
 * its arguments and returns `this`, and `await`-ing the builder
 * resolves to the wired-up `Result`.
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
    range: (...args: unknown[]) => Builder;
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
    "range",
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

function wireDealsLevelMock(
  dealsHandler: () => ReturnType<typeof makeBuilder>,
  options?: {
    stages?: Result;
    productGroups?: Result;
    employees?: Result;
    funnels?: Result;
  },
) {
  const handlers: Record<string, () => ReturnType<typeof makeBuilder>> = {
    deals: dealsHandler,
    product_groups: () =>
      makeBuilder(options?.productGroups ?? { data: [], error: null }),
  };
  if (options?.stages) {
    handlers.stages = () => makeBuilder(options.stages!);
  }
  return wireFromMock(handlers, options);
}

function wireFromMock(
  handlers: Record<string, () => ReturnType<typeof makeBuilder>>,
  options?: {
    stages?: Result;
    employees?: Result;
    funnels?: Result;
  },
) {
  const defaults = {
    funnels: makeBuilder(
      options?.funnels ?? { data: [{ id: 2 }], error: null },
    ),
    employees: makeBuilder(options?.employees ?? { data: [], error: null }),
  };
  return vi.fn((table: string) => {
    if (table === "funnels" && !handlers.funnels) return defaults.funnels;
    if (table === "employees" && !handlers.employees) return defaults.employees;
    if (table === "stages" && !handlers.stages && options?.stages) {
      return makeBuilder(options.stages);
    }
    const handler = handlers[table];
    if (handler) return handler();
    throw new Error(`Unexpected from('${table}')`);
  });
}

function withManagerId<T extends { deal_id: number; funnel_id?: number }>(
  deals: T[],
  managerId = 42,
  funnelId = 1,
): Array<T & { current_manager_id: number; funnel_id: number }> {
  return deals.map((deal) => ({
    ...deal,
    current_manager_id: managerId,
    funnel_id: deal.funnel_id ?? funnelId,
  }));
}

/** Applies `.in('deal_id', …)` / `.in('current_manager_id', …)` captured from the chain. */
function makeFilteringDealsBuilder(
  allDeals: Array<Record<string, unknown>>,
) {
  let dealIdFilter: number[] | null = null;
  let managerFilter: number[] | null = null;
  let periodFrom = "";
  let periodToExclusive = "";

  const builder = makeBuilder({ data: [], error: null, count: 0 });
  const origIn = builder.in;
  const origGte = builder.gte;
  const origLt = builder.lt;
  builder.gte = ((column: unknown, val: unknown) => {
    if (column === "created_at") periodFrom = String(val);
    return origGte(column, val);
  }) as typeof builder.gte;
  builder.lt = ((column: unknown, val: unknown) => {
    if (column === "created_at") periodToExclusive = String(val);
    return origLt(column, val);
  }) as typeof builder.lt;
  builder.in = ((column: unknown, values: unknown) => {
    if (column === "deal_id") dealIdFilter = values as number[];
    if (column === "current_manager_id") managerFilter = values as number[];
    return origIn(column, values);
  }) as typeof builder.in;

  builder.then = ((onFulfilled, onRejected) => {
    let rows = allDeals.filter((row) => {
      const createdAt = String(row.created_at ?? "2026-04-05T10:00:00Z");
      if (periodFrom && createdAt < periodFrom) return false;
      if (periodToExclusive && createdAt >= periodToExclusive) return false;
      const funnelId = Number(row.funnel_id ?? 1);
      if (funnelId === 2) return false;
      return true;
    });
    if (dealIdFilter) {
      const allowed = new Set(dealIdFilter);
      rows = rows.filter((row) => allowed.has(Number(row.deal_id)));
    }
    if (managerFilter) {
      const allowed = new Set(managerFilter);
      rows = rows.filter((row) =>
        allowed.has(Number(row.current_manager_id)),
      );
    }
    return Promise.resolve({
      data: rows,
      error: null,
      count: rows.length,
    }).then(onFulfilled, onRejected);
  }) as typeof builder.then;

  return builder;
}

const baseRequest = (
  overrides: Partial<DrilldownRequest> = {},
): DrilldownRequest => ({
  sectionSlug: "sales",
  reportSlug: "by-managers",
  rowKey: { managerId: 42 },
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: {},
  level: "product-groups",
  ...overrides,
});

// ---------------------------------------------------------------------------
// productGroups handler
// ---------------------------------------------------------------------------

describe("runProductGroupsLevel — by-managers → product-groups", () => {
  beforeEach(() => {
    resolveManagerIdAliasesFromOrgMock.mockImplementation(
      async (id: number) => [id],
    );
  });

  it("aggregates deals into per-product-group rows with merged current/previous metrics", async () => {
    // Two product groups (1, 2) in the current period; group 1 also
    // appears in the previous period. Group 2 will surface with
    // previous=0 (spec: appears only in current → previous defaults to 0).
    const dealsCurrent = withManagerId([
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
    ]);
    const dealsPrevious = withManagerId([
      {
        deal_id: 200,
        product_group_id: 1,
        amount: 600,
        team_id: 10,
        created_at: "2026-03-15T10:00:00Z",
      },
    ]);

    const allDeals = [...dealsCurrent, ...dealsPrevious];

    const productGroupsData = [
      { id: 1, name: "Group A" },
      { id: 2, name: "Group B" },
    ];

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder(allDeals),
        product_groups: () =>
          makeBuilder({ data: productGroupsData, error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const supabase = { from: fromMock };

    const res = await runProductGroupsLevel(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
    );

    expect(res.ok).toBe(true);
    expect(res.level).toBe("product-groups");
    expect(res.columns.dimension.map((d) => d.key)).toEqual([
      "product_group_name",
    ]);
    expect(res.columns.metrics.map((m) => m.id).sort()).toEqual([
      "deals_amount",
      "deals_count",
    ]);

    expect(res.rows).toHaveLength(2);

    const groupA = res.rows.find(
      (r) => r.dimension.product_group_name === "Group A",
    );
    expect(groupA).toBeDefined();
    expect(groupA!.dimension.product_group_id).toBe(1);
    expect(groupA!.metrics.deals_count.current).toBe(2);
    expect(groupA!.metrics.deals_count.previous).toBe(1);
    expect(groupA!.metrics.deals_count.delta).toBe(1);
    expect(groupA!.metrics.deals_amount.current).toBe(1500);
    expect(groupA!.metrics.deals_amount.previous).toBe(600);
    expect(groupA!.metrics.deals_amount.delta).toBe(900);

    const groupB = res.rows.find(
      (r) => r.dimension.product_group_name === "Group B",
    );
    expect(groupB).toBeDefined();
    expect(groupB!.metrics.deals_count.current).toBe(1);
    expect(groupB!.metrics.deals_count.previous).toBe(0);
    expect(groupB!.metrics.deals_count.delta).toBe(1);
    expect(groupB!.metrics.deals_count.deltaPercent).toBeNull();
    expect(groupB!.metrics.deals_amount.current).toBe(700);
    expect(groupB!.metrics.deals_amount.previous).toBe(0);

    expect(res.meta.rowKey).toEqual({ managerId: 42 });
    expect(res.meta.reportSlug).toBe("by-managers");
  });

  it("falls back to 'Группа N' when a product_group row is missing", async () => {
    const dealsCurrent = withManagerId([
      {
        deal_id: 1,
        product_group_id: 99,
        amount: 100,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
      },
    ]);

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder(dealsCurrent),
        product_groups: () => makeBuilder({ data: [], error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const res = await runProductGroupsLevel(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].dimension.product_group_name).toBe("Группа 99");
  });

  it("labels deals with null product_group_id as 'Без товарной группы'", async () => {
    const dealsCurrent = withManagerId([
      {
        deal_id: 1,
        product_group_id: null,
        amount: 100,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
      },
    ]);

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder(dealsCurrent),
        product_groups: () => makeBuilder({ data: [], error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const res = await runProductGroupsLevel(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].dimension.product_group_name).toBe(
      "Без товарной группы",
    );
    expect(res.rows[0].dimension.product_group_id).toBeNull();
  });

  it("excludes primary deals when created_at is outside the period", async () => {
    const outsidePeriodDeal = withManagerId([
      {
        deal_id: 500,
        product_group_id: 3,
        amount: 900,
        team_id: 0,
        created_at: "2026-01-10T10:00:00Z",
      },
    ])[0];

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder([outsidePeriodDeal]),
        product_groups: () =>
          makeBuilder({
            data: [{ id: 3, name: "Outside Group" }],
            error: null,
          }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const res = await runProductGroupsLevel(
      baseRequest({
        filters: {
          teamIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.rows).toHaveLength(0);
  });

  it("excludes deals where current_manager_id differs from the drilled manager", async () => {
    const ownedDeal = withManagerId([
      {
        deal_id: 600,
        product_group_id: 4,
        amount: 400,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
      },
    ], 42)[0];
    const foreignDeal = {
      deal_id: 601,
      product_group_id: 4,
      amount: 999,
      team_id: 10,
      created_at: "2026-04-05T10:00:00Z",
      current_manager_id: 99,
    };

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder([ownedDeal, foreignDeal]),
        product_groups: () =>
          makeBuilder({ data: [{ id: 4, name: "Group D" }], error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const res = await runProductGroupsLevel(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].metrics.deals_count.current).toBe(1);
    expect(res.rows[0].metrics.deals_amount.current).toBe(400);
  });

  it("excludes repeat-funnel deals from primary drill-down", async () => {
    const primaryDeal = withManagerId([
      {
        deal_id: 700,
        product_group_id: 5,
        amount: 100,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
        funnel_id: 1,
      },
    ], 42)[0];
    const repeatDeal = withManagerId([
      {
        deal_id: 701,
        product_group_id: 5,
        amount: 500,
        team_id: 10,
        created_at: "2026-04-05T10:00:00Z",
        funnel_id: 2,
      },
    ], 42)[0];

    const fromMock = wireFromMock(
      {
        deals: () => makeFilteringDealsBuilder([primaryDeal, repeatDeal]),
        product_groups: () =>
          makeBuilder({ data: [{ id: 5, name: "Group E" }], error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );

    const res = await runProductGroupsLevel(
      baseRequest(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].metrics.deals_count.current).toBe(1);
    expect(res.rows[0].metrics.deals_amount.current).toBe(100);
  });

  it("throws when rowKey.managerId is missing", async () => {
    const fromMock = vi.fn(() => makeBuilder({ data: [], error: null }));
    await expect(
      runProductGroupsLevel(
        baseRequest({ rowKey: { productGroupId: 1 } }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { from: fromMock } as any,
      ),
    ).rejects.toThrow(/managerId/);
  });

  it("propagates a deals-query error", async () => {
    const fromMock = wireFromMock(
      {
        deals: () =>
          makeBuilder({
            data: null,
            error: { message: "permission denied" },
          }),
        product_groups: () => makeBuilder({ data: [], error: null }),
      },
      {
        employees: {
          data: [{ id: 42, bitrix_id: 42 }],
          error: null,
        },
      },
    );
    await expect(
      runProductGroupsLevel(
        baseRequest(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { from: fromMock } as any,
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

// ---------------------------------------------------------------------------
// managers handler
// ---------------------------------------------------------------------------

describe("runManagersLevel — by-product-groups → managers", () => {
  beforeEach(() => {
    wireManagersOrgLookups();
  });

  it("aggregates deals into per-manager rows joined with employees + teams", async () => {
    const dealsCurrent = [
      {
        deal_id: 1,
        current_manager_id: 1,
        amount: 100,
        team_id: 10,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-04-05T10:00:00Z",
      },
      {
        deal_id: 2,
        current_manager_id: 1,
        amount: 200,
        team_id: 10,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-04-06T10:00:00Z",
      },
      {
        deal_id: 3,
        current_manager_id: 2,
        amount: 300,
        team_id: 11,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-04-07T10:00:00Z",
      },
    ];
    const dealsPrevious = [
      {
        deal_id: 4,
        current_manager_id: 1,
        amount: 50,
        team_id: 10,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-03-15T10:00:00Z",
      },
    ];

    const allDeals = [...dealsCurrent, ...dealsPrevious].map((deal) => ({
      ...deal,
      product_group_id: 5,
    }));

    const fromMock = vi.fn((table: string) => {
      if (table === "deals") {
        return makeFilteringDealsBuilder(allDeals);
      }
      if (table === "funnels") {
        return makeBuilder({ data: [{ id: 2 }], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runManagersLevel(
      baseRequest({
        reportSlug: "by-product-groups",
        rowKey: { productGroupId: 5 },
        level: "managers",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.level).toBe("managers");
    expect(res.columns.dimension.map((d) => d.key)).toEqual([
      "manager_name",
      "team_name",
    ]);

    expect(res.rows).toHaveLength(2);

    const alice = res.rows.find(
      (r) => r.dimension.manager_name === "Alice",
    );
    expect(alice).toBeDefined();
    expect(alice!.dimension.manager_id).toBe(1);
    expect(alice!.dimension.team_name).toBe("Alpha");
    expect(alice!.metrics.deals_count.current).toBe(2);
    expect(alice!.metrics.deals_amount.current).toBe(300);
    expect(alice!.metrics.deals_count.previous).toBe(1);
    expect(alice!.metrics.deals_amount.previous).toBe(50);

    const bob = res.rows.find((r) => r.dimension.manager_name === "Bob");
    expect(bob).toBeDefined();
    expect(bob!.dimension.team_name).toBe("Beta");
    expect(bob!.metrics.deals_count.current).toBe(1);
    expect(bob!.metrics.deals_amount.current).toBe(300);
    expect(bob!.metrics.deals_count.previous).toBe(0);
  });

  it("falls back to the bare manager id when no employee row matches", async () => {
    const dealsCurrent = [
      {
        deal_id: 1,
        current_manager_id: 7,
        amount: 100,
        team_id: 10,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-04-05T10:00:00Z",
      },
    ];
    const dealsResults: Result[] = [
      { data: dealsCurrent, error: null },
      { data: [], error: null },
    ];
    let dealsCall = 0;

    const fromMock = vi.fn((table: string) => {
      if (table === "deals") {
        const r = dealsResults[dealsCall] ?? dealsResults[0];
        dealsCall += 1;
        return makeBuilder(r);
      }
      if (table === "funnels") {
        return makeBuilder({ data: [{ id: 2 }], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runManagersLevel(
      baseRequest({
        reportSlug: "by-product-groups",
        rowKey: { productGroupId: 1 },
        level: "managers",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].dimension.manager_name).toBe("7");
    expect(res.rows[0].dimension.team_name).toBe("Команда 10");
  });

  it("synthesizes 'Команда N' when a teams row is missing", async () => {
    const dealsCurrent = [
      {
        deal_id: 1,
        current_manager_id: 7,
        amount: 100,
        team_id: 99,
        funnel_id: 1,
        stage_id: "NEW",
        created_at: "2026-04-05T10:00:00Z",
      },
    ];
    const dealsResults: Result[] = [
      { data: dealsCurrent, error: null },
      { data: [], error: null },
    ];
    let dealsCall = 0;

    const fromMock = vi.fn((table: string) => {
      if (table === "deals") {
        const r = dealsResults[dealsCall] ?? dealsResults[0];
        dealsCall += 1;
        return makeBuilder(r);
      }
      if (table === "funnels") {
        return makeBuilder({ data: [{ id: 2 }], error: null });
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const res = await runManagersLevel(
      baseRequest({
        reportSlug: "by-product-groups",
        rowKey: { productGroupId: 1 },
        level: "managers",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.rows[0].dimension.team_name).toBe("Команда 99");
  });

  it("throws when rowKey.productGroupId is missing", async () => {
    const fromMock = vi.fn(() => makeBuilder({ data: [], error: null }));
    await expect(
      runManagersLevel(
        baseRequest({
          reportSlug: "by-product-groups",
          rowKey: { managerId: 1 },
          level: "managers",
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { from: fromMock } as any,
      ),
    ).rejects.toThrow(/productGroupId/);
  });
});

// ---------------------------------------------------------------------------
// deals handler
// ---------------------------------------------------------------------------

describe("runDealsLevel — level=deals", () => {
  it("returns the wire shape with mapped fields, joined names and total count", async () => {
    const dealsRows = [
      {
        deal_id: 1,
        deal_name: "First deal",
        amount: 1000,
        created_at: "2026-04-05T10:00:00Z",
        stage_id: "WON",
        current_manager_id: 7,
        team_id: 10,
        product_group_id: 100,
      },
      {
        deal_id: 2,
        deal_name: null,
        amount: "500.5",
        created_at: "2026-04-06T10:00:00Z",
        stage_id: "OPEN",
        current_manager_id: 7,
        team_id: null,
        product_group_id: null,
      },
    ];

    const fromMock = wireDealsLevelMock(
      () => makeBuilder({ data: dealsRows, error: null, count: 42 }),
      {
        stages: {
          data: [
            { id: "NEW" },
            { id: "WON", name: "Закрыта" },
            { id: "OPEN", name: "В работе" },
          ],
          error: null,
        },
        productGroups: {
          data: [{ id: 100, name: "Group X" }],
          error: null,
        },
      },
    );

    const res = await runDealsLevel(
      baseRequest({ level: "deals" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.level).toBe("deals");
    expect(res.total).toBe(42);
    expect(res.rows).toHaveLength(2);

    expect(res.rows[0]).toEqual({
      dealId: 1,
      dealName: "First deal",
      amount: 1000,
      createdAt: "2026-04-05T10:00:00Z",
      stageId: "WON",
      stageName: "Закрыта",
      managerId: 7,
      teamId: 10,
      productGroupId: 100,
      productGroupName: "Group X",
    });

    // Coerces numeric strings, preserves nulls for optional joins.
    expect(res.rows[1]).toEqual({
      dealId: 2,
      dealName: null,
      amount: 500.5,
      createdAt: "2026-04-06T10:00:00Z",
      stageId: "OPEN",
      stageName: "В работе",
      managerId: 7,
      teamId: null,
      productGroupId: null,
      productGroupName: null,
    });
  });

  it("applies default limit=100 / offset=0 and reflects them in the response", async () => {
    let rangeArgs: unknown[] | null = null;
    const fromMock = wireDealsLevelMock(() => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      const origRange = builder.range;
      builder.range = ((...args: unknown[]) => {
        rangeArgs = args;
        return origRange(...args);
      }) as typeof builder.range;
      return builder;
    });

    const res = await runDealsLevel(
      baseRequest({ level: "deals" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.limit).toBe(100);
    expect(res.offset).toBe(0);
    // range(offset, offset + limit - 1) → range(0, 99)
    expect(rangeArgs).toEqual([0, 99]);
  });

  it("honors an explicit limit + offset and forwards them to range()", async () => {
    let rangeArgs: unknown[] | null = null;
    const fromMock = wireDealsLevelMock(() => {
      const builder = makeBuilder({ data: [], error: null, count: 0 });
      const origRange = builder.range;
      builder.range = ((...args: unknown[]) => {
        rangeArgs = args;
        return origRange(...args);
      }) as typeof builder.range;
      return builder;
    });

    const res = await runDealsLevel(
      baseRequest({
        level: "deals",
        limit: 50,
        offset: 200,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );

    expect(res.limit).toBe(50);
    expect(res.offset).toBe(200);
    expect(rangeArgs).toEqual([200, 249]);
  });

  it("clamps a limit greater than 1000 down to 1000 (MAX_LIMIT)", async () => {
    const fromMock = wireDealsLevelMock(() =>
      makeBuilder({ data: [], error: null, count: 0 }),
    );

    const res = await runDealsLevel(
      baseRequest({ level: "deals", limit: 9999 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.limit).toBe(1000);
  });

  it("falls back to dealRows.length when count is null", async () => {
    const dealsRows = [
      {
        deal_id: 1,
        deal_name: "x",
        amount: 1,
        created_at: "2026-04-05T10:00:00Z",
        stage_id: "S",
        current_manager_id: 1,
        team_id: 1,
        product_group_id: null,
      },
    ];
    const fromMock = wireDealsLevelMock(
      () => makeBuilder({ data: dealsRows, error: null, count: null }),
      {
        stages: { data: [{ id: "NEW" }, { id: "S", name: "Stage S" }], error: null },
      },
    );

    const res = await runDealsLevel(
      baseRequest({ level: "deals" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
    );
    expect(res.total).toBe(1);
  });

  it("propagates a deals-listing error", async () => {
    const fromMock = wireDealsLevelMock(() =>
      makeBuilder({
        data: null,
        error: { message: "boom" },
        count: null,
      }),
    );
    await expect(
      runDealsLevel(
        baseRequest({ level: "deals" }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { from: fromMock } as any,
      ),
    ).rejects.toThrow(/boom/);
  });
});
