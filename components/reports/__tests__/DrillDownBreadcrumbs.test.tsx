// @vitest-environment jsdom
/**
 * Tests for `<DrillDownBreadcrumbs />`.
 *
 * The component is a thin selector over `useDrilldownStore`. We use
 * the real store and reset its state in `beforeEach` so every test
 * sees a clean stack.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  useDrilldownStore,
  type DrilldownStackEntry,
} from "@/features/sales/state/drilldownStore";

import { DrillDownBreadcrumbs } from "../DrillDownBreadcrumbs";

const makeEntry = (
  overrides: Partial<DrilldownStackEntry> = {},
): DrilldownStackEntry => ({
  level: "product-groups",
  rowKey: { managerId: 1 },
  label: "Анна",
  ...overrides,
});

beforeEach(() => {
  useDrilldownStore.setState({
    open: false,
    reportSlug: null,
    stack: [],
  });
});

afterEach(() => {
  cleanup();
});

describe("<DrillDownBreadcrumbs /> — rendering", () => {
  it("renders nothing when the stack is empty", () => {
    const { container } = render(<DrillDownBreadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one breadcrumb per stack entry, with the labels in order", () => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [
        makeEntry({ label: "Анна" }),
        makeEntry({ level: "deals", label: "Группа A" }),
      ],
    });

    render(<DrillDownBreadcrumbs />);

    // Both labels visible in the breadcrumbs nav.
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("Группа A")).toBeInTheDocument();
  });

  it("uses a Russian-language aria-label for the breadcrumbs nav", () => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [makeEntry()],
    });
    render(<DrillDownBreadcrumbs />);
    expect(
      screen.getByRole("navigation", { name: /Хлебные крошки/ }),
    ).toBeInTheDocument();
  });

  it("marks the active (last) crumb with aria-current='page' and renders it as plain text", () => {
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [
        makeEntry({ label: "First" }),
        makeEntry({ level: "deals", label: "Second" }),
      ],
    });

    render(<DrillDownBreadcrumbs />);

    // The "Second" label is the active crumb — has aria-current and
    // is NOT rendered as a button.
    const active = screen.getByText("Second");
    expect(active).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("button", { name: "Second" }),
    ).not.toBeInTheDocument();

    // The "First" label IS rendered as a button (clickable to pop back).
    expect(
      screen.getByRole("button", { name: "First" }),
    ).toBeInTheDocument();
  });
});

describe("<DrillDownBreadcrumbs /> — interaction", () => {
  it("clicking an earlier breadcrumb invokes popTo with that index (truncates the stack)", async () => {
    const a = makeEntry({ label: "A" });
    const b = makeEntry({ level: "deals", label: "B" });
    const c = makeEntry({ level: "deals", label: "C" });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [a, b, c],
    });

    const user = userEvent.setup();
    render(<DrillDownBreadcrumbs />);

    await user.click(screen.getByRole("button", { name: "A" }));

    // popTo(0) → stack truncated to [a]
    expect(useDrilldownStore.getState().stack).toEqual([a]);
  });

  it("clicking the middle crumb pops down to that depth", async () => {
    const a = makeEntry({ label: "A" });
    const b = makeEntry({ level: "deals", label: "B" });
    const c = makeEntry({ level: "deals", label: "C" });
    useDrilldownStore.setState({
      open: true,
      reportSlug: "by-managers",
      stack: [a, b, c],
    });

    const user = userEvent.setup();
    render(<DrillDownBreadcrumbs />);

    await user.click(screen.getByRole("button", { name: "B" }));
    expect(useDrilldownStore.getState().stack).toEqual([a, b]);
  });
});
