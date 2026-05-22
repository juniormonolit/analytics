// @vitest-environment jsdom
/**
 * Tests for `<PeriodRangePicker />` and `<ComparisonRangePicker />`.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ComparisonRangePicker } from "../ComparisonRangePicker";
import { PeriodRangePicker } from "../PeriodRangePicker";
import { DateRangePresets } from "../DateRangePresets";
import { useFiltersStore } from "@/features/sales/state/filtersStore";
import { PRESETS } from "@/lib/period/presets";

const initialSnapshot = {
  period: { ...useFiltersStore.getState().period },
  comparisonPeriod: { ...useFiltersStore.getState().comparisonPeriod },
};

const PINNED_TODAY = new Date(2026, 3, 29, 12, 0, 0, 0); // 2026-04-29

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(PINNED_TODAY);
  useFiltersStore.setState({
    period: { from: "2026-04-01", to: "2026-04-28" },
    comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
    teamIds: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
  useFiltersStore.setState({
    period: initialSnapshot.period,
    comparisonPeriod: initialSnapshot.comparisonPeriod,
    teamIds: [],
  });
});

describe("<PeriodRangePicker />", () => {
  it("renders the formatted current period only", () => {
    render(<PeriodRangePicker />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("01.04.2026 — 28.04.2026");
    expect(trigger).not.toHaveTextContent("Сравнение:");
  });

  it("updates period without touching comparisonPeriod", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(<PeriodRangePicker />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Этот месяц" }));

    const state = useFiltersStore.getState();
    expect(state.period).toEqual({ from: "2026-04-01", to: "2026-04-29" });
    expect(state.comparisonPeriod).toEqual({
      from: "2026-03-04",
      to: "2026-03-31",
    });
  });

  it("re-renders when the store updates the period", () => {
    render(<PeriodRangePicker />);
    act(() => {
      useFiltersStore.getState().setPeriodOnly({
        from: "2026-05-01",
        to: "2026-05-14",
      });
    });
    expect(screen.getByRole("button")).toHaveTextContent(
      "01.05.2026 — 14.05.2026",
    );
  });
});

describe("<ComparisonRangePicker />", () => {
  it("renders the comparison period caption", () => {
    render(<ComparisonRangePicker />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Сравнение:");
    expect(trigger).toHaveTextContent("04.03.2026 — 31.03.2026");
  });

  it("updates comparisonPeriod without touching period", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    render(<ComparisonRangePicker />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Прошлый месяц" }));

    const state = useFiltersStore.getState();
    expect(state.period).toEqual({ from: "2026-04-01", to: "2026-04-28" });
    expect(state.comparisonPeriod).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });
});

describe("<DateRangePresets /> (unit fallback)", () => {
  it("renders all six presets in the documented order", () => {
    render(<DateRangePresets onSelect={() => {}} />);
    for (const preset of PRESETS) {
      expect(
        screen.getByRole("button", { name: preset.label }),
      ).toBeInTheDocument();
    }
  });

  it("forwards the clicked preset to the onSelect callback", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    const onSelect = vi.fn();
    render(<DateRangePresets onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Прошлый месяц" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("lastMonth");
    expect(onSelect.mock.calls[0][0].fn(PINNED_TODAY)).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });
});
