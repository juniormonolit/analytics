// @vitest-environment jsdom
/**
 * Smoke tests for `<MetricPickerModal />`.
 *
 * The modal is a controlled Radix Dialog: it does NOT own a trigger
 * — that belongs to `<ReportToolbar />`. So we drive `open` from the
 * test directly. `useMetricsCatalog` is mocked so we don't need a
 * QueryClientProvider and so the catalog content is deterministic.
 *
 * We verify that:
 *   - When `open={true}` the dialog title, tabs, search input and a
 *     sample metric label are all in the DOM (Radix portals render
 *     into `document.body`, so `screen.*` finds them).
 *   - When `open={false}` the body content is not in the DOM.
 *
 * Note (deviation): the BI-006 spec mentions "render the trigger;
 * click to open". The trigger lives in ReportToolbar, not in the
 * modal itself, so we exercise the modal in its controlled-open
 * state instead.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { MetricCatalogRow } from "@/features/reports/useMetricsCatalog";

const useMetricsCatalogMock = vi.fn();

vi.mock("@/features/reports/useMetricsCatalog", () => ({
  useMetricsCatalog: () => useMetricsCatalogMock(),
}));

vi.mock("@/features/sales/state/reportSetsStore", () => ({
  useReportSetsStore: (selector: (state: { hydrate: () => Promise<void> }) => unknown) =>
    selector({ hydrate: async () => {} }),
}));

import { MetricPickerModal } from "../MetricPickerModal";

const defaultModalProps = {
  reportSlug: "by-managers" as const,
  snapshot: {
    grouping: "none" as const,
    dealScope: "primary" as const,
    comparisonDisplay: "full" as const,
    teamIds: [],
  },
  onApplySet: () => {},
};

const sampleMetrics: MetricCatalogRow[] = [
  {
    id: "incoming_deals_count",
    name_ru: "Входящие сделки",
    name_short_ru: null,
    metric_type: "raw",
    data_type: "int",
    aggregation: null,
    source: null,
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: "Сделки",
    sort_order: 1,
    is_core: true,
    is_active: true,
    created_at: null,
  },
  {
    id: "won_deals_amount",
    name_ru: "Выигранные сделки",
    name_short_ru: null,
    metric_type: "raw",
    data_type: "money",
    aggregation: null,
    source: null,
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: "Продажи",
    sort_order: 2,
    is_core: true,
    is_active: true,
    created_at: null,
  },
];

afterEach(() => {
  cleanup();
  useMetricsCatalogMock.mockReset();
});

function wireCatalog(opts: {
  data?: { metrics: MetricCatalogRow[] };
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
}) {
  useMetricsCatalogMock.mockReturnValue({
    data: opts.data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    error: opts.error ?? null,
  });
}

describe("<MetricPickerModal /> — closed", () => {
  it("does not render the dialog body when open=false", () => {
    wireCatalog({ data: { metrics: sampleMetrics } });
    render(
      <MetricPickerModal
        open={false}
        onOpenChange={() => {}}
        selectedIds={["all_core"]}
        onApply={() => {}}
        {...defaultModalProps}
      />,
    );
    expect(
      screen.queryByText("Показатели отчета"),
    ).not.toBeInTheDocument();
  });
});

describe("<MetricPickerModal /> — open", () => {
  it("renders the dialog title and both tabs", () => {
    wireCatalog({ data: { metrics: sampleMetrics } });
    render(
      <MetricPickerModal
        open={true}
        onOpenChange={() => {}}
        selectedIds={["all_core"]}
        onApply={() => {}}
        {...defaultModalProps}
      />,
    );

    expect(screen.getByText("Показатели отчета")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Показатели" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Наборы" })).toBeInTheDocument();
  });

  it("renders the search input on the Показатели tab", () => {
    wireCatalog({ data: { metrics: sampleMetrics } });
    render(
      <MetricPickerModal
        open={true}
        onOpenChange={() => {}}
        selectedIds={["all_core"]}
        onApply={() => {}}
        {...defaultModalProps}
      />,
    );
    expect(
      screen.getByPlaceholderText("Поиск по названию или категории"),
    ).toBeInTheDocument();
  });

  it("renders catalog metric labels in the picker list", () => {
    wireCatalog({ data: { metrics: sampleMetrics } });
    render(
      <MetricPickerModal
        open={true}
        onOpenChange={() => {}}
        // Empty selection keeps the right-hand preview empty so each
        // metric name appears exactly once in the DOM (only in the
        // left list). Otherwise `"all_core"` resolves into the same
        // catalog rows on the right and `getByText` collides.
        selectedIds={[]}
        onApply={() => {}}
        {...defaultModalProps}
      />,
    );
    expect(screen.getByText("Входящие сделки")).toBeInTheDocument();
    expect(screen.getByText("Выигранные сделки")).toBeInTheDocument();
  });

  it("renders a loading placeholder while the catalog is loading", () => {
    wireCatalog({ isLoading: true, data: undefined });
    render(
      <MetricPickerModal
        open={true}
        onOpenChange={() => {}}
        selectedIds={["all_core"]}
        onApply={() => {}}
        {...defaultModalProps}
      />,
    );
    expect(
      screen.getByText(/Загрузка каталога/),
    ).toBeInTheDocument();
  });
});
