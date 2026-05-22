// @vitest-environment jsdom
/**
 * Smoke tests for `<DrillDownPanel />`.
 *
 * The panel composes:
 *   - `useDrilldownStore` (real Zustand singleton, reset between tests);
 *   - `useFiltersStore` (real Zustand singleton — initialized from
 *     module load with valid defaults, so we don't need to reset it);
 *   - `useDrilldownQuery` (TanStack-Query hook — mocked here so we
 *     never touch the network).
 *
 * The Radix Dialog Portal renders its content into `document.body`
 * when `open` is true and removes it from the DOM when `open` is
 * false. We assert visibility via that contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { DrillDownPanel } from "../DrillDownPanel";

const makeEntry = (
  overrides: Partial<DrilldownStackEntry> = {},
): DrilldownStackEntry => ({
  level: "product-groups",
  rowKey: { managerId: 1 },
  label: "Анна",
  ...overrides,
});

type HookReturn = {
  data?: unknown;
  isLoading?: boolean;
  error?: Error | null;
  refetch?: () => Promise<unknown>;
};

function wireHook(state: HookReturn = { isLoading: true }) {
  useDrilldownQueryMock.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
    refetch: state.refetch ?? vi.fn().mockResolvedValue(undefined),
  });
}

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

beforeEach(() => {
  useDrilldownStore.setState({
    open: false,
    reportSlug: null,
    stack: [],
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

describe("<DrillDownPanel /> — visibility", () => {
  it("does not render the panel content when open=false", () => {
    wireHook({ isLoading: true });
    render(<DrillDownPanel />);

    // Header title and the close button are inside the Portal —
    // when closed, neither should be in the DOM.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Закрыть" }),
    ).not.toBeInTheDocument();
  });

  it("renders the dialog with the active label and the period info when open=true", () => {
    wireHook({ isLoading: true });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry({ label: "Анна" })],
    });

    render(<DrillDownPanel />);

    // Title is the active stack entry's label. Radix renders
    // `Dialog.Title` as an h2 by default, so we scope to the heading
    // role to avoid matching the same label echoed in the breadcrumbs.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Анна" }),
    ).toBeInTheDocument();

    // The header includes a comparison-period line, in Russian.
    expect(screen.getByText(/Сравнение:/)).toBeInTheDocument();
  });

  it("hides the comparison period line when comparisonDisplay is current", () => {
    useReportPrefsStore.setState({
      bySlug: {
        "by-managers": { ...buildDefaultPrefs(), comparisonDisplay: "current" },
        "by-product-groups": buildDefaultPrefs(),
      },
    });
    wireHook({ isLoading: true });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry({ label: "Анна" })],
    });

    render(<DrillDownPanel />);

    expect(screen.queryByText(/Сравнение:/)).not.toBeInTheDocument();
  });

  it("falls back to 'Детализация' as the title when no entry is active", () => {
    wireHook({ isLoading: true });
    // Edge case: open=true but stack happens to be empty (defensive
    // fallback in the panel header). Not a code path the store
    // produces today, but the UI must still be safe.
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [],
    });

    render(<DrillDownPanel />);
    expect(
      screen.getByRole("heading", { name: "Детализация" }),
    ).toBeInTheDocument();
  });
});

describe("<DrillDownPanel /> — close button", () => {
  it("close button (aria-label='Закрыть') resets the store on click", async () => {
    wireHook({ isLoading: true });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry()],
    });

    const user = userEvent.setup();
    render(<DrillDownPanel />);

    const closeBtn = screen.getByRole("button", { name: "Закрыть" });
    expect(closeBtn).toBeInTheDocument();

    await user.click(closeBtn);

    const s = useDrilldownStore.getState();
    expect(s.open).toBe(false);
    expect(s.stack).toEqual([]);
    expect(s.reportSlug).toBeNull();
  });
});

describe("<DrillDownPanel /> — composition", () => {
  it("mounts the breadcrumbs trail and the level table when open=true", () => {
    wireHook({ isLoading: true });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry({ label: "Анна" })],
    });

    render(<DrillDownPanel />);

    // Breadcrumbs nav is rendered by `<DrillDownBreadcrumbs />`.
    expect(
      screen.getByRole("navigation", { name: /Хлебные крошки/ }),
    ).toBeInTheDocument();

    // Loading state from `<DrillDownLevelTable />` proves the table
    // mounted (TableSkeleton sets aria-busy on its root).
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("renders a 'Назад' button only when the stack has more than one entry", () => {
    wireHook({ isLoading: true });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry({ label: "Анна" })],
    });

    const { rerender } = render(<DrillDownPanel />);
    expect(
      screen.queryByRole("button", { name: /Назад/ }),
    ).not.toBeInTheDocument();

    // Wrap the store update in `act` so React processes the
    // subscription notifications before we re-render.
    act(() => {
      useDrilldownStore.setState({
        open: true,
        reportSlug: "by-managers",
        stack: [
          makeEntry({ label: "Анна" }),
          makeEntry({ level: "deals", label: "Сделки" }),
        ],
      });
    });
    rerender(<DrillDownPanel />);
    expect(
      screen.getByRole("button", { name: /Назад/ }),
    ).toBeInTheDocument();
  });
});
