// @vitest-environment jsdom
/**
 * Smoke tests for `<ReportTable />`.
 *
 * The component composes three stores and a TanStack Query hook. To
 * keep the assertions deterministic and the test free of network /
 * QueryClient setup we **mock** `@/features/reports/useReportQuery`
 * outright — each test wires the mock to return the
 * (loading / error / data) shape it cares about.
 *
 * The Zustand singletons (`useFiltersStore`, `useReportPrefsStore`)
 * are real; we restore each one in `beforeEach`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type {
  MetricColumn,
  Row,
  RunReportResponse,
} from "@/features/reports/engine/types";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { useReportPrefsStore } from "@/features/sales/state/reportPrefsStore";

const useReportQueryMock = vi.fn();

vi.mock("@/features/reports/useReportQuery", () => ({
  useReportQuery: (...args: unknown[]) => useReportQueryMock(...args),
  reportQueryKey: () => ["report-key"],
}));

vi.mock("@/features/reports/useMetricsCatalog", () => ({
  useMetricsCatalog: () => ({
    data: { metrics: [{ id: "incoming_deals_count" }] },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/features/settings/hooks/useMetricUiVisibility", () => ({
  useMetricUiVisibility: () => ({
    overrides: {},
    isVisible: () => true,
    defaultVisible: () => true,
    setVisible: vi.fn(),
    isAlwaysHidden: () => false,
  }),
}));

import { ReportTable } from "../ReportTable";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const buildMetricColumn = (
  overrides: Partial<MetricColumn> = {},
): MetricColumn => ({
  id: "incoming_deals_count",
  label: "Входящие сделки",
  dataType: "int",
  decimalPlaces: 0,
  aggregationFn: "sum",
  isCalculated: false,
  ...overrides,
});

const buildRow = (overrides: Partial<Row> = {}): Row => ({
  key: "manager-1",
  dimension: { manager_name: "Анна" },
  metrics: {
    incoming_deals_count: {
      current: 100,
      previous: 80,
      delta: 20,
      deltaPercent: 25,
    },
  },
  ...overrides,
});

const buildResponse = (
  overrides: Partial<RunReportResponse> = {},
): RunReportResponse => ({
  columns: {
    dimension: [{ key: "manager_name", label: "Менеджер" }],
    metrics: [buildMetricColumn()],
  },
  rows: [
    buildRow({ key: "row-1", dimension: { manager_name: "Анна" } }),
    buildRow({ key: "row-2", dimension: { manager_name: "Борис" } }),
  ],
  totals: {
    key: "totals",
    dimension: {},
    metrics: {
      incoming_deals_count: {
        current: 200,
        previous: 160,
        delta: 40,
        deltaPercent: 25,
      },
    },
  },
  meta: {
    period: { from: "2026-04-01", to: "2026-04-28" },
    comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  },
  ...overrides,
});

// Snapshot the very first state of the stores so we restore exact
// defaults between tests (mirrors the pattern used by
// `features/sales/state/__tests__/filtersStore.test.ts`).
const initialFilters = {
  period: { ...useFiltersStore.getState().period },
  comparisonPeriod: { ...useFiltersStore.getState().comparisonPeriod },
  teamIds: [] as number[],
};

const buildDefaultPrefs = () => ({
  metricIds: ["all_core"],
  columnOrder: [] as string[],
  hiddenColumns: [] as string[],
  columnWidths: {} as Record<string, number>,
  grouping: "none" as const,
  dealScope: "primary" as const,
  comparisonDisplay: "full" as const,
  sort: null,
});

beforeEach(() => {
  useFiltersStore.setState({
    period: { ...initialFilters.period },
    comparisonPeriod: { ...initialFilters.comparisonPeriod },
    teamIds: [...initialFilters.teamIds],
  });
  useReportPrefsStore.setState({
    bySlug: {
      "by-managers": buildDefaultPrefs(),
      "by-product-groups": buildDefaultPrefs(),
    },
  });
  useReportQueryMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers — wire up the mocked hook return value.
// ---------------------------------------------------------------------------

type HookReturn = {
  data?: RunReportResponse | undefined;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  refetch?: () => Promise<unknown>;
};

function wireHook(state: HookReturn) {
  useReportQueryMock.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isFetching: state.isFetching ?? false,
    error: state.error ?? null,
    refetch: state.refetch ?? vi.fn().mockResolvedValue(undefined),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("<ReportTable /> — happy path", () => {
  it("renders the dimension and metric column headers", () => {
    wireHook({ data: buildResponse() });
    render(<ReportTable reportSlug="by-managers" />);

    // Dimension header: rendered as a button (clickable for sort).
    expect(
      screen.getByRole("button", { name: /Менеджер/ }),
    ).toBeInTheDocument();

    // Metric group header: rendered in a colgroup-spanning <th>.
    expect(screen.getByText("Входящие сделки")).toBeInTheDocument();

    // The four sub-headers under each metric group. Use exact-string
    // accessible-name match so "Δ" doesn't accidentally match the
    // "Δ%" button (regex word-boundaries don't apply to non-ASCII).
    expect(screen.getByRole("button", { name: "Текущий" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Сравнение" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Δ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Δ%" })).toBeInTheDocument();
  });

  it("renders each row's dimension cell", () => {
    wireHook({ data: buildResponse() });
    render(<ReportTable reportSlug="by-managers" />);

    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("Борис")).toBeInTheDocument();
  });

  it("renders the totals row with the «Итого» label", () => {
    wireHook({ data: buildResponse() });
    render(<ReportTable reportSlug="by-managers" />);

    expect(screen.getByText("Итого")).toBeInTheDocument();
  });

  it("falls back to all_core in the report request when metricIds is empty", () => {
    useReportPrefsStore.setState({
      bySlug: {
        "by-managers": { ...buildDefaultPrefs(), metricIds: [] },
        "by-product-groups": buildDefaultPrefs(),
      },
    });
    wireHook({ data: buildResponse() });
    render(<ReportTable reportSlug="by-managers" />);

    expect(useReportQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metricIds: ["all_core"],
        uiHiddenMetricIds: [],
      }),
    );
  });
});

describe("<ReportTable /> — non-happy states", () => {
  it("renders the loading skeleton when the hook is loading", () => {
    wireHook({ isLoading: true });
    const { container } = render(<ReportTable reportSlug="by-managers" />);
    // TableSkeleton sets aria-busy on its root.
    expect(
      container.querySelector('[aria-busy="true"]'),
    ).toBeInTheDocument();
    // Make sure no data rows leaked in.
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
  });

  it("renders the empty state when the response has zero rows", () => {
    wireHook({
      data: {
        ...buildResponse(),
        rows: [],
        totals: null,
      },
    });
    render(<ReportTable reportSlug="by-managers" />);
    expect(
      screen.getByText("Нет данных за выбранный период"),
    ).toBeInTheDocument();
  });

  it("renders the error state with the message and a retry button", () => {
    wireHook({ error: new Error("Boom") });
    render(<ReportTable reportSlug="by-managers" />);

    expect(
      screen.getByText("Не удалось загрузить отчет"),
    ).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Попробовать снова/ }),
    ).toBeInTheDocument();
  });
});
