// @vitest-environment jsdom
/**
 * Tests for `<GroupingSwitch />`.
 *
 * The component is a controlled segmented switch wired straight to
 * `useReportPrefsStore`. We exercise the rendered ARIA structure and
 * the click → store side effect using the real Zustand singleton
 * (resetting `bySlug` between tests for isolation).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useReportPrefsStore } from "@/features/sales/state/reportPrefsStore";

import { GroupingSwitch } from "../GroupingSwitch";

const buildDefaultPrefs = () => ({
  metricIds: ["all_core"],
  columnOrder: [] as string[],
  hiddenColumns: [] as string[],
  columnWidths: {} as Record<string, number>,
  grouping: "none" as const,
  sort: null,
});

const buildDefaultBySlug = () => ({
  "by-managers": buildDefaultPrefs(),
  "by-product-groups": buildDefaultPrefs(),
});

beforeEach(() => {
  useReportPrefsStore.setState({ bySlug: buildDefaultBySlug() });
});

afterEach(() => {
  cleanup();
});

describe("<GroupingSwitch /> rendering", () => {
  it("renders the three grouping options with the correct Russian labels", () => {
    render(<GroupingSwitch reportSlug="by-managers" />);
    expect(screen.getByRole("radio", { name: "Нет" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Отдел" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Итого" })).toBeInTheDocument();
  });

  it("wraps the buttons in a radiogroup labelled 'Группировка'", () => {
    render(<GroupingSwitch reportSlug="by-managers" />);
    expect(
      screen.getByRole("radiogroup", { name: "Группировка" }),
    ).toBeInTheDocument();
  });

  it("marks the active option with aria-checked='true'", () => {
    useReportPrefsStore.setState((s) => ({
      bySlug: {
        ...s.bySlug,
        "by-managers": { ...s.bySlug["by-managers"], grouping: "team" },
      },
    }));
    render(<GroupingSwitch reportSlug="by-managers" />);

    expect(screen.getByRole("radio", { name: "Отдел" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Нет" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Итого" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("<GroupingSwitch /> interaction", () => {
  it("writes the selected grouping into the store on click", async () => {
    const user = userEvent.setup();
    render(<GroupingSwitch reportSlug="by-managers" />);

    await user.click(screen.getByRole("radio", { name: "Отдел" }));
    expect(
      useReportPrefsStore.getState().bySlug["by-managers"].grouping,
    ).toBe("team");

    await user.click(screen.getByRole("radio", { name: "Итого" }));
    expect(
      useReportPrefsStore.getState().bySlug["by-managers"].grouping,
    ).toBe("total");

    await user.click(screen.getByRole("radio", { name: "Нет" }));
    expect(
      useReportPrefsStore.getState().bySlug["by-managers"].grouping,
    ).toBe("none");
  });

  it("does not affect a sibling slug's grouping", async () => {
    const user = userEvent.setup();
    render(<GroupingSwitch reportSlug="by-managers" />);

    await user.click(screen.getByRole("radio", { name: "Итого" }));

    expect(
      useReportPrefsStore.getState().bySlug["by-managers"].grouping,
    ).toBe("total");
    expect(
      useReportPrefsStore.getState().bySlug["by-product-groups"].grouping,
    ).toBe("none");
  });
});
