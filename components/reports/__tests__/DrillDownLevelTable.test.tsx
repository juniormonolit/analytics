// @vitest-environment jsdom
/**
 * Tests for `<DrillDownLevelTable />`.
 *
 * The table reads `useDrilldownStore` (real singleton, reset between
 * tests) and calls `useDrilldownQuery` (mocked here). We exercise the
 * three rendering branches that matter to the panel UX:
 *
 *   1. Aggregate level — rows are clickable and clicking pushes a
 *      deals-level entry onto the stack.
 *   2. Deals level — renders the deal columns and shows the
 *      «Загрузить ещё» button only when there are more rows on the
 *      server than currently on screen.
 *   3. Empty state — when the response has zero rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  DealRow,
  DrilldownAggregateResponse,
  DrilldownDealsResponse,
} from "@/features/reports/drilldown/types";
import {
  useDrilldownStore,
  type DrilldownStackEntry,
} from "@/features/sales/state/drilldownStore";
import { useReportPrefsStore } from "@/features/sales/state/reportPrefsStore";

const useDrilldownQueryMock = vi.fn();

vi.mock("@/features/reports/useDrilldownQuery", () => ({
  useDrilldownQuery: (...args: unknown[]) => useDrilldownQueryMock(...args),
  drilldownQueryKey: () => ["drilldown-key"],
}));

import { DrillDownLevelTable } from "../DrillDownLevelTable";

type HookReturn = {
  data?: DrilldownAggregateResponse | DrilldownDealsResponse | undefined;
  isLoading?: boolean;
  error?: Error | null;
  refetch?: () => Promise<unknown>;
};

function wireHook(state: HookReturn) {
  useDrilldownQueryMock.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
    refetch: state.refetch ?? vi.fn().mockResolvedValue(undefined),
  });
}

const makeEntry = (
  overrides: Partial<DrilldownStackEntry> = {},
): DrilldownStackEntry => ({
  level: "product-groups",
  rowKey: { managerId: 1 },
  label: "Анна",
  ...overrides,
});

const buildDefaultPrefs = () => ({
  metricIds: ["all_core"],
  columnOrder: [],
  hiddenColumns: [],
  columnWidths: {},
  grouping: "none" as const,
  dealScope: "primary" as const,
  comparisonDisplay: "full" as const,
  sort: null,
});

const buildAggregateResponse = (
  overrides: Partial<DrilldownAggregateResponse> = {},
): DrilldownAggregateResponse => ({
  ok: true,
  level: "product-groups",
  columns: {
    dimension: [{ key: "product_group_name", label: "Товарная группа" }],
    metrics: [
      {
        id: "deals_count",
        label: "Кол-во сделок",
        dataType: "int",
        decimalPlaces: 0,
        aggregationFn: "sum",
        isCalculated: false,
        formula: null,
      },
      {
        id: "deals_amount",
        label: "Сумма сделок",
        dataType: "money",
        decimalPlaces: 0,
        aggregationFn: "sum",
        isCalculated: false,
        formula: null,
      },
    ],
  },
  rows: [
    {
      key: "1",
      dimension: { product_group_id: 1, product_group_name: "Group A" },
      metrics: {
        deals_count: { current: 5, previous: 3, delta: 2, deltaPercent: 66.67 },
        deals_amount: {
          current: 1182713,
          previous: 85300,
          delta: 1097413,
          deltaPercent: 1286.55,
        },
      },
    },
  ],
  meta: {
    period: { from: "2026-04-01", to: "2026-04-28" },
    comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
    rowKey: { managerId: 1 },
    reportSlug: "by-managers",
  },
  ...overrides,
});

const buildDealRow = (overrides: Partial<DealRow> = {}): DealRow => ({
  dealId: 1,
  dealName: "Сделка #1",
  amount: 1000,
  createdAt: "2026-04-05T10:00:00Z",
  stageId: "WON",
  stageName: "Закрыта",
  managerId: 7,
  teamId: 10,
  productGroupId: 100,
  productGroupName: "Group A",
  ...overrides,
});

const buildDealsResponse = (
  overrides: Partial<DrilldownDealsResponse> = {},
): DrilldownDealsResponse => ({
  ok: true,
  level: "deals",
  rows: [buildDealRow()],
  total: 1,
  limit: 100,
  offset: 0,
  meta: {
    period: { from: "2026-04-01", to: "2026-04-28" },
    comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
    rowKey: { managerId: 1, productGroupId: 1 },
    reportSlug: "by-managers",
  },
  ...overrides,
});

beforeEach(() => {
  useDrilldownStore.setState({
    open: true,
    reportSlug: "by-managers",
    stack: [makeEntry()],
  });
  useReportPrefsStore.setState({
    bySlug: {
      "by-managers": buildDefaultPrefs(),
      "by-product-groups": buildDefaultPrefs(),
    },
  });
  useDrilldownQueryMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("<DrillDownLevelTable /> — root tabs (by-managers)", () => {
  it("shows Товары / Сделки tabs at the first drill-down level", () => {
    wireHook({ data: buildAggregateResponse() });
    render(<DrillDownLevelTable />);
    expect(screen.getByRole("tab", { name: "Товары" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Сделки" })).toBeInTheDocument();
  });

  it("requests deals level when the Сделки tab is selected", async () => {
    wireHook({ data: buildDealsResponse({ total: 1 }) });
    const user = userEvent.setup();
    render(<DrillDownLevelTable />);

    await user.click(screen.getByRole("tab", { name: "Сделки" }));

    expect(useDrilldownQueryMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        level: "deals",
        rowKey: { managerId: 1 },
      }),
    );
    expect(screen.getByText("Сделка")).toBeInTheDocument();
  });

  it("does not show root tabs when drilling into a product group", () => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [
        makeEntry(),
        makeEntry({
          level: "deals",
          rowKey: { managerId: 1, productGroupId: 1 },
          label: "Group A",
        }),
      ],
    });
    wireHook({ data: buildDealsResponse() });
    render(<DrillDownLevelTable />);
    expect(screen.queryByRole("tab", { name: "Товары" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Сделки" })).not.toBeInTheDocument();
  });
});

describe("<DrillDownLevelTable /> — aggregate level", () => {
  it("renders the dimension and metric column headers from the response", () => {
    wireHook({ data: buildAggregateResponse() });
    render(<DrillDownLevelTable />);
    expect(screen.getByText("Товарная группа")).toBeInTheDocument();
    expect(screen.getByText("Кол-во сделок")).toBeInTheDocument();
    expect(screen.getByText("Сумма сделок")).toBeInTheDocument();
  });

  it("hides comparison sub-columns when comparisonDisplay is current", () => {
    useReportPrefsStore.setState({
      bySlug: {
        "by-managers": { ...buildDefaultPrefs(), comparisonDisplay: "current" },
        "by-product-groups": buildDefaultPrefs(),
      },
    });
    wireHook({ data: buildAggregateResponse() });
    render(<DrillDownLevelTable />);

    expect(screen.queryByText("Сравнение")).not.toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("1 182 713 ₽")).toBeInTheDocument();
  });

  it("renders each row's dimension cell as a clickable button", () => {
    wireHook({ data: buildAggregateResponse() });
    render(<DrillDownLevelTable />);
    expect(screen.getByText("Group A")).toBeInTheDocument();
    // Aggregate rows are role=button (and tabIndex=0) so keyboard
    // navigation works.
    const rows = screen.getAllByRole("button");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("clicking a product-groups row pushes a deals-level entry onto the stack", async () => {
    wireHook({ data: buildAggregateResponse() });
    const user = userEvent.setup();
    render(<DrillDownLevelTable />);

    await user.click(screen.getByText("Group A"));

    const stack = useDrilldownStore.getState().stack;
    expect(stack).toHaveLength(2);
    expect(stack[1]).toMatchObject({
      level: "deals",
      label: "Group A",
      rowKey: { managerId: 1, productGroupId: 1 },
    });
  });

  it("clicking a managers row pushes a deals-level entry with the managerId", async () => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-product-groups",
      stack: [
        makeEntry({
          level: "managers",
          rowKey: { productGroupId: 5 },
          label: "Group X",
        }),
      ],
    });

    wireHook({
      data: buildAggregateResponse({
        level: "managers",
        columns: {
          dimension: [
            { key: "manager_name", label: "Менеджер" },
            { key: "team_name", label: "Отдел" },
          ],
          metrics: [
            {
              id: "deals_count",
              label: "Кол-во сделок",
              dataType: "int",
              decimalPlaces: 0,
              aggregationFn: "sum",
              isCalculated: false,
              formula: null,
            },
          ],
        },
        rows: [
          {
            key: "7",
            dimension: {
              manager_id: 7,
              manager_name: "Bob",
              team_id: 10,
              team_name: "Alpha",
            },
            metrics: {
              deals_count: {
                current: 3,
                previous: 1,
                delta: 2,
                deltaPercent: 200,
              },
            },
          },
        ],
      }),
    });

    const user = userEvent.setup();
    render(<DrillDownLevelTable />);

    await user.click(screen.getByText("Bob"));

    const stack = useDrilldownStore.getState().stack;
    expect(stack).toHaveLength(2);
    expect(stack[1]).toMatchObject({
      level: "deals",
      label: "Bob",
      rowKey: { productGroupId: 5, managerId: 7 },
    });
  });

  it("renders the empty state when rows is empty", () => {
    wireHook({
      data: buildAggregateResponse({ rows: [] }),
    });
    render(<DrillDownLevelTable />);
    expect(
      screen.getByText("Нет данных за выбранный период"),
    ).toBeInTheDocument();
  });
});

describe("<DrillDownLevelTable /> — deals level", () => {
  beforeEach(() => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [
        makeEntry({
          level: "deals",
          rowKey: { managerId: 1, productGroupId: 1 },
          label: "Group A",
        }),
      ],
    });
  });

  it("renders the deals header columns in Russian", () => {
    wireHook({ data: buildDealsResponse() });
    render(<DrillDownLevelTable />);
    expect(screen.getByText("Сделка")).toBeInTheDocument();
    expect(screen.getByText("Сумма")).toBeInTheDocument();
    expect(screen.getByText("Стадия")).toBeInTheDocument();
    expect(screen.getByText("Создана")).toBeInTheDocument();
    expect(screen.getByText("Менеджер")).toBeInTheDocument();
    expect(screen.getByText("Товарная группа")).toBeInTheDocument();
  });

  it("renders the «Показано N из M» footer with the correct counts", () => {
    wireHook({
      data: buildDealsResponse({
        rows: [buildDealRow({ dealId: 1 }), buildDealRow({ dealId: 2 })],
        total: 50,
      }),
    });
    render(<DrillDownLevelTable />);
    // The footer span contains "Показано {N} из {M}" — assert on the
    // composite text content via toHaveTextContent so we don't rely
    // on exact whitespace handling between text-and-number children.
    const footerSpan = screen.getByText(/Показано/);
    expect(footerSpan).toHaveTextContent(/Показано\s*2\s*из\s*50/);
  });

  it("shows «Загрузить ещё» when shown < total", () => {
    wireHook({
      data: buildDealsResponse({
        rows: [buildDealRow()],
        total: 200,
      }),
    });
    render(<DrillDownLevelTable />);
    expect(
      screen.getByRole("button", { name: /Загрузить ещё/ }),
    ).toBeInTheDocument();
  });

  it("renders deal names as links to Monolit CRM", () => {
    wireHook({ data: buildDealsResponse() });
    render(<DrillDownLevelTable />);
    const link = screen.getByRole("link", { name: "Сделка #1" });
    expect(link).toHaveAttribute(
      "href",
      "https://td.monolit-crm.ru/crm/deal/details/1/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides «Загрузить ещё» when shown === total", () => {
    wireHook({
      data: buildDealsResponse({
        rows: [buildDealRow()],
        total: 1,
      }),
    });
    render(<DrillDownLevelTable />);
    expect(
      screen.queryByRole("button", { name: /Загрузить ещё/ }),
    ).not.toBeInTheDocument();
  });
});

describe("<DrillDownLevelTable /> — non-data states", () => {
  it("renders the loading skeleton while isLoading is true", () => {
    wireHook({ isLoading: true });
    const { container } = render(<DrillDownLevelTable />);
    expect(
      container.querySelector('[aria-busy="true"]'),
    ).toBeInTheDocument();
  });

  it("renders the error state when error is set", () => {
    wireHook({ error: new Error("Boom") });
    render(<DrillDownLevelTable />);
    expect(
      screen.getByText("Не удалось загрузить отчет"),
    ).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
