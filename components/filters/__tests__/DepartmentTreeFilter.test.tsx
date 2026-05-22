// @vitest-environment jsdom
/**
 * Tests for `<DepartmentTreeFilter />` (BI-004).
 *
 * `useTeamsTree` is mocked so we never hit the network — the component
 * only cares about the discriminated-union shape it returns.
 *
 * Coverage:
 *   - Trigger label switches between "Все отделы" and "Отделы (N)".
 *   - Opening the popover renders the tree (rendered into the Radix
 *     portal; `screen` scans `document.body`).
 *   - Clicking a parent's checkbox selects every leaf below it; the
 *     applied store state is the sorted leaf id list.
 *   - "Очистить" only clears the *draft* — store state is committed
 *     by "Применить".
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockTreeNodes = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Отдел продаж",
    isActive: true,
    children: [
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Sub A1",
        isActive: true,
        children: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            name: "Leaf A1.1",
            isActive: true,
            children: [],
          },
          {
            id: "55555555-5555-5555-5555-555555555555",
            name: "Leaf A1.2",
            isActive: true,
            children: [],
          },
        ],
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Leaf A2",
        isActive: true,
        children: [],
      },
    ],
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "Root B",
    isActive: true,
    children: [],
  },
];

const ROOT_A = "11111111-1111-1111-1111-111111111111";
const SALES_ROOT_LABEL = "Отдел продаж";
const SUB_A1 = "22222222-2222-2222-2222-222222222222";
const LEAF_A2 = "33333333-3333-3333-3333-333333333333";
const LEAF_A1_1 = "44444444-4444-4444-4444-444444444444";
const LEAF_A1_2 = "55555555-5555-5555-5555-555555555555";

const ROOT_A_SUBTREE = [ROOT_A, SUB_A1, LEAF_A2, LEAF_A1_1, LEAF_A1_2].sort(
  (a, b) => a.localeCompare(b),
);

vi.mock("@/features/sales/hooks/useTeamsTree", () => ({
  useTeamsTree: () => ({
    data: { kind: "tree", nodes: mockTreeNodes },
    isLoading: false,
    isError: false,
  }),
}));

import { DepartmentTreeFilter } from "../DepartmentTreeFilter";
import { useFiltersStore } from "@/features/sales/state/filtersStore";

const initialSnapshot = {
  period: { ...useFiltersStore.getState().period },
  comparisonPeriod: { ...useFiltersStore.getState().comparisonPeriod },
};

beforeEach(() => {
  useFiltersStore.setState({
    period: initialSnapshot.period,
    comparisonPeriod: initialSnapshot.comparisonPeriod,
    teamIds: [],
  });
});

afterEach(() => {
  useFiltersStore.setState({
    period: initialSnapshot.period,
    comparisonPeriod: initialSnapshot.comparisonPeriod,
    teamIds: [],
  });
});

describe("<DepartmentTreeFilter /> trigger label", () => {
  it('shows "Все отделы" when the store has no team selection', () => {
    render(<DepartmentTreeFilter />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Все отделы");
  });

  it('shows "Отделы (N)" when the store has a non-empty teamIds list', () => {
    useFiltersStore.setState({
      teamIds: [LEAF_A2, LEAF_A1_1, LEAF_A1_2],
    });
    render(<DepartmentTreeFilter />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Отделы (3)");
  });
});

describe("<DepartmentTreeFilter /> popover", () => {
  it("opens the popover and renders Применить / Очистить controls", async () => {
    const user = userEvent.setup();
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Все отделы/ }));

    expect(screen.getByText("Отделы")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Применить" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Очистить" }),
    ).toBeInTheDocument();
  });

  it("clicking a parent selects the whole subtree; Применить commits the sorted list", async () => {
    const user = userEvent.setup();
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Все отделы/ }));

    // Root A has leaves [4, 5, 3] under it (Sub A1 → 4,5 plus Leaf A2 → 3).
    // Toggling its checkbox should add all of them; Применить commits
    // the sorted list to the store.
    await user.click(screen.getByRole("checkbox", { name: SALES_ROOT_LABEL }));
    await user.click(screen.getByRole("button", { name: "Применить" }));

    expect(useFiltersStore.getState().teamIds).toEqual(ROOT_A_SUBTREE);
  });

  it("partial selection collapses to fully-checked when the parent checkbox is clicked", async () => {
    const user = userEvent.setup();
    useFiltersStore.setState({ teamIds: [LEAF_A1_1] });
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Отделы \(1\)/ }));

    const rootAChk = screen.getByRole("checkbox", { name: SALES_ROOT_LABEL });
    expect(rootAChk).toHaveAttribute("aria-checked", "mixed");

    // Click parent → all leaves selected.
    await user.click(rootAChk);
    await user.click(screen.getByRole("button", { name: "Применить" }));

    expect(useFiltersStore.getState().teamIds).toEqual(ROOT_A_SUBTREE);
  });

  it("clicking the same parent twice (when fully selected) deselects all its leaves", async () => {
    const user = userEvent.setup();
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Все отделы/ }));

    const rootAChk = screen.getByRole("checkbox", { name: SALES_ROOT_LABEL });
    await user.click(rootAChk); // select all under Root A
    await user.click(rootAChk); // toggle off
    await user.click(screen.getByRole("button", { name: "Применить" }));

    expect(useFiltersStore.getState().teamIds).toEqual([]);
  });

  it("Очистить clears only the local draft — store updates only on Применить", async () => {
    const user = userEvent.setup();
    useFiltersStore.setState({
      teamIds: [LEAF_A2, LEAF_A1_1, LEAF_A1_2],
    });
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Отделы \(3\)/ }));

    await user.click(screen.getByRole("button", { name: "Очистить" }));
    // Draft cleared, but the store still reflects the old commit.
    expect(useFiltersStore.getState().teamIds).toEqual([
      LEAF_A2,
      LEAF_A1_1,
      LEAF_A1_2,
    ]);

    await user.click(screen.getByRole("button", { name: "Применить" }));
    expect(useFiltersStore.getState().teamIds).toEqual([]);
  });

  it("shows only the sales department subtree", async () => {
    const user = userEvent.setup();
    render(<DepartmentTreeFilter />);

    await user.click(screen.getByRole("button", { name: /Все отделы/ }));

    expect(
      screen.getByRole("checkbox", { name: SALES_ROOT_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Root B" }),
    ).not.toBeInTheDocument();
  });
});
