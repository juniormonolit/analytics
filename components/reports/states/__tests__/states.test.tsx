// @vitest-environment jsdom
/**
 * Tests for the three placeholder views used by `<ReportTable />`:
 *   - `<TableSkeleton />` — animated loading state.
 *   - `<EmptyState />`    — "no data for this period".
 *   - `<ErrorState />`    — failure + optional retry button.
 *
 * Pure presentational components — we assert visible text, basic
 * accessibility markers, and the retry click handler.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { TableSkeleton } from "../TableSkeleton";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// TableSkeleton
// ---------------------------------------------------------------------------

describe("<TableSkeleton />", () => {
  it("renders an aria-busy live region (loading announcement)", () => {
    const { container } = render(<TableSkeleton />);
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveAttribute("aria-live", "polite");
  });

  it("renders pulsing skeleton blocks with the design-token bg-skeleton class", () => {
    const { container } = render(<TableSkeleton />);
    const blocks = container.querySelectorAll(".bg-skeleton");
    // Header row + 8 body rows × 6 columns = 6 + 48 = 54 blocks total
    // (these counts are implementation-defined constants in the source;
    // we only assert "many", not the exact count, to stay flake-free).
    expect(blocks.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

describe("<EmptyState />", () => {
  it("renders the canonical Russian empty-state message", () => {
    render(<EmptyState />);
    expect(
      screen.getByText("Нет данных за выбранный период"),
    ).toBeInTheDocument();
  });

  it("renders a hint to change filters or period", () => {
    render(<EmptyState />);
    expect(
      screen.getByText("Измените период или фильтры отделов."),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

describe("<ErrorState />", () => {
  it("renders the canonical headline message", () => {
    render(<ErrorState />);
    expect(
      screen.getByText("Не удалось загрузить отчет"),
    ).toBeInTheDocument();
  });

  it("renders the supplied error message when provided", () => {
    render(<ErrorState message="Network down" />);
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorState message="boom" />);
    expect(
      screen.queryByRole("button", { name: /Попробовать снова/ }),
    ).not.toBeInTheDocument();
  });

  it("renders a retry button and invokes the onRetry callback when clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState message="boom" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: /Попробовать снова/ });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
