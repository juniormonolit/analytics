// @vitest-environment jsdom
/**
 * Smoke test for `<ReportPageContent />`'s hydration boundary.
 *
 * The component is responsible for triggering
 * `useReportPrefsStore.getState().hydrate(slug)` exactly once on mount
 * — that's how the persisted (user, report) prefs come back from
 * localStorage after SSR. We assert that single side-effect and let
 * the child components stay mocked out: `ReportTable` /
 * `ReportToolbar` already have their own dedicated test files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { useReportPrefsStore } from "@/features/sales/state/reportPrefsStore";

const useReportQueryMock = vi.fn();

vi.mock("@/features/reports/useReportQuery", () => ({
  useReportQuery: (...args: unknown[]) => useReportQueryMock(...args),
  reportQueryKey: () => ["report-key"],
}));

// Stub the heavy children — both compose stores + react-query themselves
// and aren't under test here.
vi.mock("../ReportToolbar", () => ({
  ReportToolbar: () => null,
}));
vi.mock("../ReportTable", () => ({
  ReportTable: () => null,
}));

import { ReportPageContent } from "../ReportPageContent";

beforeEach(() => {
  useReportQueryMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("<ReportPageContent /> — hydration on mount", () => {
  it("calls useReportPrefsStore.getState().hydrate with the report slug", () => {
    const hydrateSpy = vi
      .spyOn(useReportPrefsStore.getState(), "hydrate")
      .mockResolvedValue();

    render(<ReportPageContent reportSlug="by-managers" />);

    expect(hydrateSpy).toHaveBeenCalledTimes(1);
    expect(hydrateSpy).toHaveBeenCalledWith("by-managers");
  });

  it("passes the new slug to hydrate when the prop changes", () => {
    const hydrateSpy = vi
      .spyOn(useReportPrefsStore.getState(), "hydrate")
      .mockResolvedValue();

    const { rerender } = render(
      <ReportPageContent reportSlug="by-managers" />,
    );
    rerender(<ReportPageContent reportSlug="by-product-groups" />);

    // Initial mount + slug change effect.
    expect(hydrateSpy).toHaveBeenCalledTimes(2);
    expect(hydrateSpy).toHaveBeenNthCalledWith(1, "by-managers");
    expect(hydrateSpy).toHaveBeenNthCalledWith(2, "by-product-groups");
  });
});
