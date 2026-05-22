/**
 * Tests for `features/sales/state/filtersStore.ts`.
 *
 * The store is a tiny Zustand singleton: each test resets it back to
 * the initial state captured at module-load time so cases stay
 * independent. We do not mock `defaultPeriod` / `recomputeComparison`
 * — they are pure and exhaustively tested in
 * `lib/period/__tests__/defaults.test.ts`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { useFiltersStore } from "../filtersStore";

// Capture the initial snapshot exactly once at module load. Subsequent
// tests restore from this snapshot in their `beforeEach`.
const DEPT_A = "11111111-1111-4111-8111-111111111111";
const DEPT_B = "22222222-2222-4222-8222-222222222222";
const DEPT_C = "33333333-3333-4333-8333-333333333333";

const initialSnapshot = {
  period: useFiltersStore.getState().period,
  comparisonPeriod: useFiltersStore.getState().comparisonPeriod,
  teamIds: [] as string[],
};

beforeEach(() => {
  useFiltersStore.setState({
    period: { ...initialSnapshot.period },
    comparisonPeriod: { ...initialSnapshot.comparisonPeriod },
    teamIds: [...initialSnapshot.teamIds],
  });
});

describe("filtersStore — initial state", () => {
  it("period and comparisonPeriod are valid ISO Period objects", () => {
    const state = useFiltersStore.getState();
    expect(state.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.comparisonPeriod.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.comparisonPeriod.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("period.from <= period.to (non-empty range)", () => {
    const { period } = useFiltersStore.getState();
    expect(period.from <= period.to).toBe(true);
  });

  it("teamIds defaults to an empty array", () => {
    expect(useFiltersStore.getState().teamIds).toEqual([]);
  });
});

describe("setPeriod()", () => {
  it("replaces period and auto-recomputes comparisonPeriod (28-day rule)", () => {
    useFiltersStore.getState().setPeriod({
      from: "2026-04-01",
      to: "2026-04-28",
    });
    const s = useFiltersStore.getState();
    expect(s.period).toEqual({ from: "2026-04-01", to: "2026-04-28" });
    // Same-length tail of the previous month — see defaults.test.ts
    expect(s.comparisonPeriod).toEqual({
      from: "2026-03-04",
      to: "2026-03-31",
    });
  });

  it("recomputes comparison whenever period changes (5-day case)", () => {
    useFiltersStore.getState().setPeriod({
      from: "2026-04-05",
      to: "2026-04-09",
    });
    const s = useFiltersStore.getState();
    expect(s.period).toEqual({ from: "2026-04-05", to: "2026-04-09" });
    expect(s.comparisonPeriod).toEqual({
      from: "2026-03-27",
      to: "2026-03-31",
    });
  });

  it("does not touch teamIds", () => {
    useFiltersStore.setState({ teamIds: [DEPT_A, DEPT_B] });
    useFiltersStore.getState().setPeriod({
      from: "2026-04-01",
      to: "2026-04-28",
    });
    expect(useFiltersStore.getState().teamIds).toEqual([DEPT_A, DEPT_B]);
  });
});

describe("setComparisonPeriod()", () => {
  it("updates only comparisonPeriod, leaves period untouched", () => {
    const before = useFiltersStore.getState().period;
    useFiltersStore.getState().setComparisonPeriod({
      from: "2024-01-01",
      to: "2024-01-31",
    });
    const s = useFiltersStore.getState();
    expect(s.comparisonPeriod).toEqual({
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(s.period).toEqual(before);
  });

  it("does not touch teamIds", () => {
    useFiltersStore.setState({ teamIds: [DEPT_C] });
    useFiltersStore.getState().setComparisonPeriod({
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(useFiltersStore.getState().teamIds).toEqual([DEPT_C]);
  });
});

describe("setPeriodPair()", () => {
  it("sets both period and comparisonPeriod atomically", () => {
    useFiltersStore.getState().setPeriodPair(
      { from: "2026-05-01", to: "2026-05-14" },
      { from: "2026-04-17", to: "2026-04-30" },
    );
    const s = useFiltersStore.getState();
    expect(s.period).toEqual({ from: "2026-05-01", to: "2026-05-14" });
    expect(s.comparisonPeriod).toEqual({
      from: "2026-04-17",
      to: "2026-04-30",
    });
  });

  it("can set arbitrary (non-default) comparison without recomputing", () => {
    // Unlike setPeriod, setPeriodPair preserves the comparison value
    // exactly as supplied — this is what the calendar/preset flow uses.
    useFiltersStore.getState().setPeriodPair(
      { from: "2026-04-01", to: "2026-04-28" },
      { from: "2024-01-01", to: "2024-01-31" },
    );
    expect(useFiltersStore.getState().comparisonPeriod).toEqual({
      from: "2024-01-01",
      to: "2024-01-31",
    });
  });
});

describe("setTeamIds()", () => {
  it("replaces the teamIds array (does not merge)", () => {
    useFiltersStore.getState().setTeamIds([DEPT_A, DEPT_B, DEPT_C]);
    expect(useFiltersStore.getState().teamIds).toEqual([
      DEPT_A,
      DEPT_B,
      DEPT_C,
    ]);

    useFiltersStore.getState().setTeamIds([DEPT_C]);
    expect(useFiltersStore.getState().teamIds).toEqual([DEPT_C]);
  });

  it("accepts an empty array (= 'all departments')", () => {
    useFiltersStore.getState().setTeamIds([DEPT_A, DEPT_B]);
    useFiltersStore.getState().setTeamIds([]);
    expect(useFiltersStore.getState().teamIds).toEqual([]);
  });
});

describe("hydrate()", () => {
  it("partially updates only the supplied fields", () => {
    const before = useFiltersStore.getState();
    useFiltersStore.getState().hydrate({
      period: { from: "2026-01-01", to: "2026-01-31" },
    });
    const s = useFiltersStore.getState();
    expect(s.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(s.comparisonPeriod).toEqual(before.comparisonPeriod);
    expect(s.teamIds).toEqual(before.teamIds);
  });

  it("can update multiple fields at once", () => {
    useFiltersStore.getState().hydrate({
      period: { from: "2026-01-01", to: "2026-01-31" },
      comparisonPeriod: { from: "2025-12-01", to: "2025-12-31" },
      teamIds: [DEPT_A, DEPT_B],
    });
    const s = useFiltersStore.getState();
    expect(s.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(s.comparisonPeriod).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(s.teamIds).toEqual([DEPT_A, DEPT_B]);
  });

  it("an empty patch is a no-op", () => {
    const before = useFiltersStore.getState();
    useFiltersStore.getState().hydrate({});
    const after = useFiltersStore.getState();
    expect(after.period).toEqual(before.period);
    expect(after.comparisonPeriod).toEqual(before.comparisonPeriod);
    expect(after.teamIds).toEqual(before.teamIds);
  });
});
