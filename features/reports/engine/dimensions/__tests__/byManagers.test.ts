// @vitest-environment node
/**
 * Tests for `features/reports/engine/dimensions/byManagers.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MetricRow } from "../../metricsCatalog";
import { applyGrouping } from "../../grouping";
import { mergeByDimension } from "../../comparison";
import {
  byManagers,
  formatManagerLabel,
  formatTeamLabel,
  resolveEmployeeForManagerId,
  resolveTeamIdForManager,
} from "../byManagers";

vi.mock("server-only", () => ({}));

const DEPT_ID = "654fef1e-ccbf-4659-9d44-184013d27de9";
const DEPT_NAME = "Отдел продаж НЦ";

const {
  loadManagerEmployeesByManagerIdsMock,
  loadDepartmentNamesByIdsMock,
  loadManagerEmployeeAliasesByManagerIdsMock,
  loadEmployeeAliasLookupsForManagersMock,
} = vi.hoisted(() => ({
  loadManagerEmployeesByManagerIdsMock: vi.fn(),
  loadDepartmentNamesByIdsMock: vi.fn(),
  loadManagerEmployeeAliasesByManagerIdsMock: vi.fn(),
  loadEmployeeAliasLookupsForManagersMock: vi.fn(),
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
  };
});

const DEPT_ID_2 = "354cf56d-f957-4baf-aa0c-d755ccf714fc";
const DEPT_NAME_2 = "Отдел продаж Юг";

function wireOrgLookupsMulti() {
  loadManagerEmployeesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.map((id) => {
        if (id === 1906) {
          return {
            id: "emp-43",
            bitrix_id: 1906,
            full_name: "Пётр Петров",
            team_id: DEPT_ID_2,
          };
        }
        return {
          id: "emp-42",
          bitrix_id: 1867,
          full_name: "Иван Иванов",
          team_id: DEPT_ID,
        };
      }),
  );
  loadDepartmentNamesByIdsMock.mockImplementation(async (ids: string[]) =>
    new Map(
      ids.map((id) => [id, id === DEPT_ID_2 ? DEPT_NAME_2 : DEPT_NAME]),
    ),
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
}

function wireOrgLookups() {
  loadManagerEmployeesByManagerIdsMock.mockImplementation(
    async (ids: number[]) =>
      ids.map((id) => ({
        id: "emp-42",
        bitrix_id: id,
        full_name: "Иван Иванов",
        team_id: DEPT_ID,
      })),
  );
  loadDepartmentNamesByIdsMock.mockImplementation(async (ids: string[]) =>
    new Map(ids.map((id) => [id, DEPT_NAME])),
  );
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

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    lt: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    or: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    range: (...args: unknown[]) => Builder;
    then: PromiseLike<Result>["then"];
  };
  const builder = {} as Builder;
  for (const m of [
    "select",
    "eq",
    "gte",
    "lte",
    "lt",
    "in",
    "or",
    "order",
    "range",
  ] as const) {
    builder[m] = (() => builder) as Builder[typeof m];
  }
  builder.then = ((onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected)) as Builder["then"];
  return builder;
}

function makePeriodDealsBuilder(deals: PeriodDealRow[]) {
  let periodFrom = "";
  let periodToExclusive = "";
  let dateColumn: keyof PeriodDealRow | null = null;

  const builder = makeBuilder({ data: [], error: null });
  const origGte = builder.gte.bind(builder);
  const origLt = builder.lt.bind(builder);
  const origIn = builder.in.bind(builder);
  let managerFilter: number[] | null = null;
  let dealIdFilter: number[] | null = null;

  builder.gte = ((col: unknown, val: unknown) => {
    if (col === "created_at") {
      periodFrom = String(val);
      dateColumn = "created_at";
    } else if (
      col === "sold_at" ||
      col === "delivered_at" ||
      col === "reserved_at" ||
      col === "confirmed_at"
    ) {
      periodFrom = String(val);
      dateColumn = col as keyof PeriodDealRow;
    }
    return origGte(col, val);
  }) as typeof builder.gte;
  builder.lt = ((col: unknown, val: unknown) => {
    if (col === "created_at") {
      periodToExclusive = String(val);
      dateColumn = "created_at";
    } else if (
      col === "sold_at" ||
      col === "delivered_at" ||
      col === "reserved_at" ||
      col === "confirmed_at"
    ) {
      periodToExclusive = String(val);
      dateColumn = col as keyof PeriodDealRow;
    }
    return origLt(col, val);
  }) as typeof builder.lt;
  builder.in = ((col: unknown, values: unknown) => {
    if (col === "current_manager_id") managerFilter = values as number[];
    if (col === "deal_id") dealIdFilter = values as number[];
    return origIn(col, values);
  }) as typeof builder.in;

  builder.then = ((onFulfilled, onRejected) => {
    let rows = deals.filter((deal) => {
      const milestoneAt =
        dateColumn === "created_at"
          ? (deal.created_at ?? "2026-05-10T10:00:00")
          : dateColumn != null
            ? (deal[dateColumn] as string | null | undefined)
            : (deal.created_at ?? "2026-05-10T10:00:00");
      if (milestoneAt == null) return false;
      if (periodFrom && milestoneAt < periodFrom) return false;
      if (periodToExclusive && milestoneAt >= periodToExclusive) return false;
      return true;
    });
    if (managerFilter) {
      const allowed = new Set(managerFilter);
      rows = rows.filter((row) => allowed.has(row.current_manager_id));
    }
    if (dealIdFilter) {
      const allowed = new Set(dealIdFilter);
      rows = rows.filter((row) => allowed.has(row.deal_id));
    }
    return Promise.resolve({ data: rows, error: null }).then(
      onFulfilled,
      onRejected,
    );
  }) as typeof builder.then;

  return builder;
}

type DealEventRow = {
  deal_id: number;
  stage_id: string;
  manager_id?: number;
  amount_at_event?: number | null;
  event_at?: string;
};

function makeDealEventsBuilder(events: DealEventRow[]) {
  let periodFrom = "";
  let periodToExclusive = "";
  let stageIdFilter: string[] | null = null;
  let dealIdFilter: number[] | null = null;

  const builder = makeBuilder({ data: [], error: null });
  const origGte = builder.gte.bind(builder);
  const origLt = builder.lt.bind(builder);
  const origIn = builder.in.bind(builder);

  builder.gte = ((col: unknown, val: unknown) => {
    if (col === "event_at") periodFrom = String(val);
    return origGte(col, val);
  }) as typeof builder.gte;
  builder.lt = ((col: unknown, val: unknown) => {
    if (col === "event_at") periodToExclusive = String(val);
    return origLt(col, val);
  }) as typeof builder.lt;
  builder.in = ((col: unknown, values: unknown) => {
    if (col === "stage_id") stageIdFilter = values as string[];
    if (col === "deal_id") dealIdFilter = values as number[];
    return origIn(col, values);
  }) as typeof builder.in;

  builder.then = ((onFulfilled, onRejected) => {
    let rows = events.map((event) => ({
      deal_id: event.deal_id,
      stage_id: event.stage_id,
      manager_id: event.manager_id ?? 1867,
      amount_at_event: event.amount_at_event ?? null,
      event_at: event.event_at ?? "2026-05-10T10:00:00",
    }));
    if (periodFrom) {
      rows = rows.filter((row) => row.event_at >= periodFrom);
    }
    if (periodToExclusive) {
      rows = rows.filter((row) => row.event_at < periodToExclusive);
    }
    if (stageIdFilter) {
      const allowed = new Set(stageIdFilter);
      rows = rows.filter((row) => allowed.has(row.stage_id));
    }
    if (dealIdFilter) {
      const allowed = new Set(dealIdFilter);
      rows = rows.filter((row) => allowed.has(row.deal_id));
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

type PeriodDealRow = {
  deal_id: number;
  current_manager_id: number;
  funnel_id: number;
  stage_id?: string;
  amount?: number;
  created_at?: string;
  sold_at?: string | null;
  delivered_at?: string | null;
  reserved_at?: string | null;
  confirmed_at?: string | null;
};

function defaultCalledDealsMocks(options: {
  periodDeals?: PeriodDealRow[];
  dealEvents?: DealEventRow[];
  calledStageIds?: string[];
}) {
  const periodDeals = options.periodDeals ?? [];
  const dealEvents = options.dealEvents ?? [];
  const calledStageIds = options.calledStageIds ?? ["C2:CALLED"];

  return (table: string) => {
    if (table === "stages") {
      return makeBuilder({
        data: calledStageIds.map((id) => ({ id })),
        error: null,
      });
    }
    if (table === "funnels") {
      return makeBuilder({
        data: [{ id: REPEAT_FUNNEL_ID }],
        error: null,
      });
    }
    if (table === "deal_events") {
      return makeDealEventsBuilder(dealEvents);
    }
    if (table === "deals") {
      return makePeriodDealsBuilder(periodDeals);
    }
    throw new Error(`Unexpected from('${table}') in called deals mock setup`);
  };
}

function defaultHistoricalStageMocks(options: {
  periodDeals?: PeriodDealRow[];
  dealEvents?: DealEventRow[];
  stageIds?: string[];
}) {
  const periodDeals = options.periodDeals ?? [];
  const dealEvents = options.dealEvents ?? [];
  const stageIds = options.stageIds ?? ["ST:RESERVED"];

  return (table: string) => {
    if (table === "stages") {
      return makeBuilder({
        data: stageIds.map((id) => ({ id })),
        error: null,
      });
    }
    if (table === "funnels") {
      return makeBuilder({
        data: [{ id: REPEAT_FUNNEL_ID }],
        error: null,
      });
    }
    if (table === "deal_events") {
      return makeDealEventsBuilder(dealEvents);
    }
    if (table === "deals") {
      return makePeriodDealsBuilder(periodDeals);
    }
    throw new Error(
      `Unexpected from('${table}') in historical stage mock setup`,
    );
  };
}

function reservationsMetric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "reservations_count",
    name_ru: "Брони",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "int",
    aggregation: null,
    source: "deal_events",
    source_column: "reservations_count",
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

function confirmedReservationsMetric(
  overrides: Partial<MetricRow> = {},
): MetricRow {
  return {
    id: "confirmed_reservations_count",
    name_ru: "Подтв. брони",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "int",
    aggregation: null,
    source: "deal_events",
    source_column: "confirmed_reservations_count",
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

function calledMetric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "called_deals_count",
    name_ru: "Созвонился",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "int",
    aggregation: null,
    source: "deals",
    source_column: "called_deals_count",
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

function defaultPrimaryDealsMocks(options: {
  periodDeals?: PeriodDealRow[];
  repeatFunnelIds?: number[];
}) {
  const periodDeals = options.periodDeals ?? [];
  const repeatFunnelIds = options.repeatFunnelIds ?? [REPEAT_FUNNEL_ID];

  return (table: string) => {
    if (table === "funnels") {
      return makeBuilder({
        data: repeatFunnelIds.map((id) => ({ id })),
        error: null,
      });
    }
    if (table === "deals") {
      return makePeriodDealsBuilder(periodDeals);
    }
    throw new Error(`Unexpected from('${table}') in primary deals mock setup`);
  };
}

function metric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "primary_deals_count",
    name_ru: "РџРµСЂРІРёС‡РЅС‹Рµ СЃРґРµР»РєРё",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "int",
    aggregation: null,
    source: "deals",
    source_column: "deal_id",
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

function repeatMetric(overrides: Partial<MetricRow> = {}): MetricRow {
  return metric({
    id: "repeat_deals_count",
    name_ru: "РџРѕРІС‚РѕСЂРЅС‹Рµ СЃРґРµР»РєРё",
    source_column: "deal_id",
    ...overrides,
  });
}

describe("byManagers resolve helpers", () => {
  const employee = {
    id: "emp-42",
    bitrix_id: 1867,
    full_name: "Иван Иванов",
    team_id: DEPT_ID,
  };

  it("resolves employee by bitrix_id first", () => {
    const byBitrixId = new Map([[1867, employee]]);
    const byId = new Map<string, typeof employee>();
    expect(
      resolveEmployeeForManagerId(1867, byBitrixId, byId)?.full_name,
    ).toBe("Иван Иванов");
  });

  it("prefers org department_id over daily_sales.team_id=0", () => {
    expect(resolveTeamIdForManager(0, DEPT_ID)).toBe(DEPT_ID);
    expect(resolveTeamIdForManager(0, employee.team_id)).toBe(DEPT_ID);
  });

  it("formats missing manager and team fallbacks", () => {
    expect(formatManagerLabel(1867, undefined)).toBe("Менеджер #1867");
    expect(formatTeamLabel("unknown", new Map())).toBe("—");
    expect(formatTeamLabel(DEPT_ID, new Map([[DEPT_ID, DEPT_NAME]]))).toBe(
      DEPT_NAME,
    );
  });
});

describe("byManagers.fetch()", () => {
  beforeEach(() => {
    wireOrgLookups();
  });

  function wireFetchMock(periodDeals: PeriodDealRow[]) {
    return vi.fn((table: string) =>
      defaultPrimaryDealsMocks({ periodDeals })(table),
    );
  }

  it("maps bitrix manager_id to full_name and counts primary deals from deals", async () => {
    const periodDeals = Array.from({ length: 10 }, (_, index) => ({
      deal_id: index + 1,
      current_manager_id: 1867,
      funnel_id: PRIMARY_FUNNEL_ID,
    }));

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: wireFetchMock(periodDeals) } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [metric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dimension).toMatchObject({
      manager_id: 1867,
      manager_name: "Иван Иванов",
      team_id: DEPT_ID,
      team_name: DEPT_NAME,
    });
    expect(rows[0].raw.primary_deals_count).toBe(10);
  });

  it("counts incoming deals from deals.created_at only", async () => {
    const periodDeals = Array.from({ length: 8 }, (_, index) => ({
      deal_id: index + 1,
      current_manager_id: 1867,
      funnel_id: PRIMARY_FUNNEL_ID,
      created_at: "2026-05-18T10:00:00",
    }));

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: wireFetchMock(periodDeals) } as any,
      { from: "2026-05-18", to: "2026-05-18" },
      undefined,
      [metric({ id: "incoming_deals_count", source_column: "incoming_deals_count" })],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.incoming_deals_count).toBe(8);
  });

  it("counts distinct primary deal_id and excludes repeat funnels", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 3,
        current_manager_id: 1867,
        funnel_id: REPEAT_FUNNEL_ID,
      },
    ];

    const supabase = { from: wireFetchMock(periodDeals) } as any;
    const period = { from: "2026-05-01", to: "2026-05-18" };
    const metrics = [metric()];

    const rowsPrimary = await byManagers.fetch(
      supabase,
      period,
      undefined,
      metrics,
      "primary",
    );
    expect(rowsPrimary).toHaveLength(1);
    expect(rowsPrimary[0].raw.primary_deals_count).toBe(2);

    const rowsRepeat = await byManagers.fetch(
      supabase,
      period,
      undefined,
      metrics,
      "repeat",
    );
    expect(rowsRepeat[0].raw.primary_deals_count).toBe(1);

    const rowsAll = await byManagers.fetch(
      supabase,
      period,
      undefined,
      metrics,
      "all",
    );
    expect(rowsAll[0].raw.primary_deals_count).toBe(3);
  });

  it("creates manager rows from primary deals even without daily_sales rows", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: wireFetchMock(periodDeals) } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [metric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.primary_deals_count).toBe(1);
  });

  it("uses resolved team_id for grouping=team", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];

    const intermediate = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: wireFetchMock(periodDeals) } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [metric()],
    );
    const merged = mergeByDimension(intermediate, []);
    const grouped = applyGrouping(merged, "team", [metric()]);

    const label = grouped.rows.find((r) => r.key === `teamLabel:${DEPT_ID}`);
    expect(label).toBeDefined();
    expect(label?.groupLabel).toBe(DEPT_NAME);
    expect(grouped.rows.some((r) => r.dimension.manager_name === "Иван Иванов")).toBe(
      true,
    );
    expect(grouped.rows.some((r) => r.key === `teamSubtotal:${DEPT_ID}`)).toBe(true);
  });

  it("filters rows by resolved team_id when teamIds filter is provided", async () => {
    wireOrgLookupsMulti();
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 2,
        current_manager_id: 1906,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];

    const fromMock = vi.fn((table: string) => {
      const primary = defaultPrimaryDealsMocks({ periodDeals });
      return primary(table);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      [DEPT_ID],
      [metric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dimension.manager_name).toBe("Иван Иванов");
    expect(rows[0].dimension.team_id).toBe(DEPT_ID);
  });

  it("attributes primary deals by deals.current_manager_id", async () => {
    wireOrgLookupsMulti();
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];

    const fromMock = vi.fn((table: string) => {
      const primary = defaultPrimaryDealsMocks({ periodDeals });
      return primary(table);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [metric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dimension.manager_name).toBe("Иван Иванов");
    expect(rows[0].raw.primary_deals_count).toBe(2);
  });

  it("counts called_deals_count from deal_events in period", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 3,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];
    const dealEvents = [
      { deal_id: 1, stage_id: "C2:CALLED" },
      { deal_id: 3, stage_id: "C2:CALLED" },
    ];

    const fromMock = vi.fn((table: string) => {
      const called = defaultCalledDealsMocks({ periodDeals, dealEvents });
      return called(table);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [calledMetric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.called_deals_count).toBe(2);
  });

  it("counts reservations_count from deals.reserved_at in period", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        reserved_at: "2026-05-10T10:00:00",
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 3,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        reserved_at: "2026-05-11T10:00:00",
      },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "funnels") {
        return makeBuilder({
          data: [{ id: REPEAT_FUNNEL_ID }],
          error: null,
        });
      }
      if (table === "deals") {
        return makePeriodDealsBuilder(periodDeals);
      }
      throw new Error(`Unexpected from('${table}') in reservations mock setup`);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [reservationsMetric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.reservations_count).toBe(2);
  });

  it("counts confirmed_reservations_count from deals.confirmed_at in period", async () => {
    const periodDeals = [
      {
        deal_id: 10,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        confirmed_at: "2026-05-10T10:00:00",
      },
      {
        deal_id: 11,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        reserved_at: "2026-05-10T10:00:00",
      },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "funnels") {
        return makeBuilder({
          data: [{ id: REPEAT_FUNNEL_ID }],
          error: null,
        });
      }
      if (table === "deals") {
        return makePeriodDealsBuilder(periodDeals);
      }
      throw new Error(`Unexpected from('${table}') in confirmed mock setup`);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [confirmedReservationsMetric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.confirmed_reservations_count).toBe(1);
  });

  it("merges internal employees.id onto bitrix_id for current_manager_id", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 42,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: wireFetchMock(periodDeals) } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [metric()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].dimension.manager_id).toBe(1867);
    expect(rows[0].raw.primary_deals_count).toBe(1);
  });

  it("counts sales and shipments from deals milestone dates in period", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        amount: 1000,
        sold_at: "2026-05-10T10:00:00",
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        amount: 2000,
        delivered_at: "2026-05-11T10:00:00",
      },
      {
        deal_id: 3,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        amount: 3000,
        delivered_at: "2026-05-12T10:00:00",
      },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "funnels") {
        return makeBuilder({
          data: [{ id: REPEAT_FUNNEL_ID }],
          error: null,
        });
      }
      if (table === "deals") {
        return makePeriodDealsBuilder(periodDeals);
      }
      throw new Error(`Unexpected from('${table}') in sales mock setup`);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      [
        metric({
          id: "primary_sales_count",
          source_column: "primary_sales_count",
        }),
        metric({
          id: "primary_sales_amount",
          source_column: "primary_sales_amount",
          data_type: "money",
        }),
        metric({
          id: "primary_shipments_count",
          source_column: "primary_shipments_count",
        }),
        metric({
          id: "primary_shipments_amount",
          source_column: "primary_shipments_amount",
          data_type: "money",
        }),
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.primary_sales_count).toBe(1);
    expect(rows[0].raw.primary_sales_amount).toBe(1000);
    expect(rows[0].raw.primary_shipments_count).toBe(2);
    expect(rows[0].raw.primary_shipments_amount).toBe(5000);
  });

  it("does not double-count sale when shipment happens in a later period", async () => {
    const periodDeals = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
        amount: 1000,
        sold_at: "2026-04-10T10:00:00",
        delivered_at: "2026-05-15T10:00:00",
      },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "funnels") {
        return makeBuilder({
          data: [{ id: REPEAT_FUNNEL_ID }],
          error: null,
        });
      }
      if (table === "deals") {
        return makePeriodDealsBuilder(periodDeals);
      }
      throw new Error(`Unexpected from('${table}') in cross-period sales mock`);
    });

    const metrics = [
      metric({
        id: "primary_sales_count",
        source_column: "primary_sales_count",
      }),
      metric({
        id: "primary_shipments_count",
        source_column: "primary_shipments_count",
      }),
    ];

    const aprilRows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-04-01", to: "2026-04-30" },
      undefined,
      metrics,
    );
    const mayRows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-31" },
      undefined,
      metrics,
    );

    expect(aprilRows[0].raw.primary_sales_count).toBe(1);
    expect(aprilRows[0].raw.primary_shipments_count).toBe(0);
    expect(mayRows[0].raw.primary_sales_count).toBe(0);
    expect(mayRows[0].raw.primary_shipments_count).toBe(1);
  });

  it("loads hidden called_deals_count dependency for conversion metrics", async () => {
    const periodDeals: PeriodDealRow[] = [
      {
        deal_id: 1,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 2,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
      {
        deal_id: 3,
        current_manager_id: 1867,
        funnel_id: PRIMARY_FUNNEL_ID,
      },
    ];
    const dealEvents = [
      { deal_id: 2, stage_id: "C2:CALLED" },
      { deal_id: 3, stage_id: "C2:CALLED" },
    ];

    const fetchMetrics = [
      metric({
        id: "conv_incoming_to_called",
        metric_type: "calculated",
        data_type: "percent",
        source: "formula",
        source_column: null,
        dependencies: ["called_deals_count", "incoming_deals_count"],
      }),
      calledMetric(),
      metric({
        id: "incoming_deals_count",
        source_column: "incoming_deals_count",
      }),
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "funnels" || table === "deals") {
        return defaultPrimaryDealsMocks({ periodDeals })(table);
      }
      if (table === "stages") {
        return makeBuilder({
          data: [{ id: "C2:CALLED" }],
          error: null,
        });
      }
      if (table === "deal_events") {
        return makeDealEventsBuilder(dealEvents);
      }
      throw new Error(`Unexpected from('${table}')`);
    });

    const rows = await byManagers.fetch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { from: fromMock } as any,
      { from: "2026-05-01", to: "2026-05-18" },
      undefined,
      fetchMetrics,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].raw.incoming_deals_count).toBe(3);
    expect(rows[0].raw.called_deals_count).toBe(2);

    const { buildMetricCells } = await import("../../aggregate");
    const cells = buildMetricCells(
      fetchMetrics,
      rows[0].raw,
      {},
      rows[0].count,
      0,
    );
    expect(cells.conv_incoming_to_called.current).toBeCloseTo(66.666, 2);
  });
});
