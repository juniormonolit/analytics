// @vitest-environment jsdom
/**
 * Focused tests for `<DepartmentTreeNode />` — the recursive tree row
 * used by `<DepartmentTreeFilter />`.
 *
 * The interesting behavior is the tri-state checkbox: the `aria-checked`
 * attribute must report `"mixed"` for indeterminate, and the DOM
 * `indeterminate` flag (which is not a reflected attribute) must be
 * set imperatively after mount. Both are exercised here.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  DepartmentTreeNode,
  type CheckboxState,
} from "../DepartmentTreeNode";

const sampleNode = {
  id: 1,
  name: "Root A",
  isActive: true,
  children: [
    { id: 2, name: "Leaf 1", isActive: true, children: [] },
    { id: 3, name: "Leaf 2", isActive: true, children: [] },
  ],
};

function renderNode(args: {
  state?: CheckboxState;
  expanded?: boolean;
  onToggleSelected?: () => void;
  onToggleExpanded?: (id: number) => void;
}) {
  const states = new Map<number, CheckboxState>([
    [1, args.state ?? "unchecked"],
    [2, "unchecked"],
    [3, "unchecked"],
  ]);
  const expanded = new Set<number>(args.expanded ? [1] : []);
  return render(
    <DepartmentTreeNode
      node={sampleNode}
      selectionByNodeId={states}
      expandedIds={expanded}
      onToggleExpanded={args.onToggleExpanded ?? (() => {})}
      onToggleSelected={args.onToggleSelected ?? (() => {})}
      depth={0}
    />,
  );
}

describe("<DepartmentTreeNode /> tri-state checkbox", () => {
  it("renders aria-checked='mixed' for indeterminate state", () => {
    renderNode({ state: "indeterminate" });
    const checkbox = screen.getByRole("checkbox", { name: "Root A" });
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    // The DOM `indeterminate` flag is a property, not a reflected
    // attribute — verify it imperatively.
    expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
  });

  it("renders aria-checked='true' when checked", () => {
    renderNode({ state: "checked" });
    const checkbox = screen.getByRole("checkbox", { name: "Root A" });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect((checkbox as HTMLInputElement).indeterminate).toBe(false);
  });

  it("renders aria-checked='false' when unchecked", () => {
    renderNode({ state: "unchecked" });
    const checkbox = screen.getByRole("checkbox", { name: "Root A" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect((checkbox as HTMLInputElement).indeterminate).toBe(false);
  });
});

describe("<DepartmentTreeNode /> expand/collapse + selection callbacks", () => {
  it("calls onToggleSelected with the node when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSelected = vi.fn();
    renderNode({ onToggleSelected });

    await user.click(screen.getByRole("checkbox", { name: "Root A" }));
    expect(onToggleSelected).toHaveBeenCalledTimes(1);
  });

  it("does not render children when collapsed; renders them when expanded", () => {
    const { rerender } = renderNode({ expanded: false });
    expect(screen.queryByText("Leaf 1")).toBeNull();

    const states = new Map<number, CheckboxState>([
      [1, "unchecked"],
      [2, "unchecked"],
      [3, "unchecked"],
    ]);
    rerender(
      <DepartmentTreeNode
        node={sampleNode}
        selectionByNodeId={states}
        expandedIds={new Set([1])}
        onToggleExpanded={() => {}}
        onToggleSelected={() => {}}
        depth={0}
      />,
    );
    expect(screen.getByText("Leaf 1")).toBeInTheDocument();
    expect(screen.getByText("Leaf 2")).toBeInTheDocument();
  });

  it("calls onToggleExpanded(id) when the chevron is clicked", async () => {
    const user = userEvent.setup();
    const onToggleExpanded = vi.fn();
    renderNode({ onToggleExpanded });

    await user.click(screen.getByRole("button", { name: "Развернуть" }));
    expect(onToggleExpanded).toHaveBeenCalledWith(1);
  });
});
