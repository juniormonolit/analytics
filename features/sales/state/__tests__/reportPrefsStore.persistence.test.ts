/**
 * Persistence tests for `features/sales/state/reportPrefsStore.ts`.
 *
 * BI-008 wires the store to `reportPreferencesRepository` (the
 * localStorage-backed singleton). These tests cover the round-trip:
 *
 *   - `hydrate(slug)` reads from the repository and merges into the
 *     slug's prefs.
 *   - Setters auto-persist on a 200 ms debounce.
 *   - Slug + userKey namespacing produces independent storage keys.
 *   - `reset(slug)` clears both the in-memory state and the persisted
 *     record.
 *
 * Strategy:
 *   - We use real `localStorage` (jsdom default) and the real
 *     repository singleton — the persistence path *is* the system
 *     under test.
 *   - Fake timers (`vi.useFakeTimers()`) so the 200 ms debounce becomes
 *     deterministic.
 *   - The store is reset between tests by replacing `bySlug`,
 *     `hydrationBySlug`, and `userKey` with fresh defaults (mirrors the
 *     pattern used by `reportPrefsStore.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReportPrefsStore } from "../reportPrefsStore";

const buildDefaultPrefs = () => ({
  metricIds: ["all_core"],
  columnOrder: [] as string[],
  hiddenColumns: [] as string[],
  columnWidths: {} as Record<string, number>,
  grouping: "none" as const,
  dealScope: "primary" as const,
  comparisonDisplay: "full" as const,
  sort: null,
});

const buildDefaultBySlug = () => ({
  "by-managers": buildDefaultPrefs(),
  "by-product-groups": buildDefaultPrefs(),
});

const buildDefaultHydration = () =>
  ({
    "by-managers": "idle",
    "by-product-groups": "idle",
  }) as const;

beforeEach(() => {
  // Fake timers cover the 200 ms debounce inside `schedulePersist`.
  vi.useFakeTimers();

  // Fresh store state. `userKey` reset to the documented default;
  // `hydrationBySlug` reset so `hydrate` is allowed to run again.
  useReportPrefsStore.setState({
    bySlug: buildDefaultBySlug(),
    hydrationBySlug: { ...buildDefaultHydration() },
    userKey: "local",
  });

  // localStorage is already cleared globally by vitest.setup.ts; this
  // is a belt-and-suspenders guard for clarity.
  window.localStorage.clear();
});

afterEach(() => {
  // Drop any pending debounced persists so they don't leak into the
  // next test's localStorage assertions.
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pre-seed a stored payload in localStorage as if the repository had
 * written it. Bypasses the repository so we can pin the on-disk shape.
 */
function seedStored(
  storageKey: string,
  payload: Record<string, unknown>,
): void {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ ...payload, prefsVersion: 1 }),
  );
}

/**
 * Returns the parsed JSON value at `storageKey`, or `null` if the key
 * is missing.
 */
function readStored(storageKey: string): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(storageKey);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

/**
 * Advance fake timers past the persist debounce window and let any
 * trailing microtasks (the repository's `async save` body) settle.
 */
async function flushDebounce(): Promise<void> {
  vi.advanceTimersByTime(250);
  // The repository's `save` is an async function with no awaits, so
  // its body runs synchronously inside the timer callback. A single
  // microtask flush is still sufficient to settle the returned
  // Promise so any awaiting test code resumes cleanly.
  await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

describe("hydrate(slug)", () => {
  it("returns defaults when nothing is stored for the slug", async () => {
    await useReportPrefsStore.getState().hydrate("by-managers");

    const prefs = useReportPrefsStore.getState().bySlug["by-managers"];
    expect(prefs).toEqual(buildDefaultPrefs());
  });

  it("merges the stored partial over defaults (only stored fields override)", async () => {
    seedStored("bi.prefs.local.sales.by-managers", {
      metricIds: ["incoming_deals_count", "won_deals_amount"],
      grouping: "team",
    });

    await useReportPrefsStore.getState().hydrate("by-managers");

    const prefs = useReportPrefsStore.getState().bySlug["by-managers"];
    expect(prefs).toEqual({
      ...buildDefaultPrefs(),
      metricIds: ["incoming_deals_count", "won_deals_amount"],
      grouping: "team",
    });
  });

  it("flips hydrationBySlug[slug] to 'hydrated' on completion", async () => {
    expect(
      useReportPrefsStore.getState().hydrationBySlug["by-managers"],
    ).toBe("idle");

    await useReportPrefsStore.getState().hydrate("by-managers");

    expect(
      useReportPrefsStore.getState().hydrationBySlug["by-managers"],
    ).toBe("hydrated");
  });

  it("migrates empty stored metricIds to all_core and re-persists", async () => {
    seedStored("bi.prefs.local.sales.by-managers", {
      metricIds: [],
      grouping: "team",
    });

    await useReportPrefsStore.getState().hydrate("by-managers");
    await flushDebounce();

    expect(useReportPrefsStore.getState().bySlug["by-managers"].metricIds).toEqual(
      ["all_core"],
    );
    expect(useReportPrefsStore.getState().bySlug["by-managers"].grouping).toBe(
      "team",
    );
    expect(readStored("bi.prefs.local.sales.by-managers")?.metricIds).toEqual([
      "all_core",
    ]);
  });

  it("does not clobber the other slug's prefs when called sequentially", async () => {
    seedStored("bi.prefs.local.sales.by-managers", {
      metricIds: ["a", "b"],
      grouping: "team",
    });
    seedStored("bi.prefs.local.sales.by-product-groups", {
      metricIds: ["x", "y", "z"],
      grouping: "total",
    });

    await useReportPrefsStore.getState().hydrate("by-managers");
    await useReportPrefsStore.getState().hydrate("by-product-groups");

    const state = useReportPrefsStore.getState();
    expect(state.bySlug["by-managers"]).toEqual({
      ...buildDefaultPrefs(),
      metricIds: ["a", "b"],
      grouping: "team",
    });
    expect(state.bySlug["by-product-groups"]).toEqual({
      ...buildDefaultPrefs(),
      metricIds: ["x", "y", "z"],
      grouping: "total",
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-persist (debounced)
// ---------------------------------------------------------------------------

describe("setter auto-persist", () => {
  it("setMetricIds persists to localStorage after the 200 ms debounce", async () => {
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["incoming_deals_count"]);

    // Before the debounce fires, nothing has been written yet.
    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-managers"),
    ).toBeNull();

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored).not.toBeNull();
    expect(stored?.metricIds).toEqual(["incoming_deals_count"]);
    expect(stored?.prefsVersion).toBe(1);
  });

  it("setGrouping persists to localStorage after the debounce", async () => {
    useReportPrefsStore.getState().setGrouping("by-managers", "team");

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.grouping).toBe("team");
  });

  it("setSort persists the sort descriptor", async () => {
    useReportPrefsStore.getState().setSort("by-managers", {
      columnId: "metric:incoming_deals_count.current",
      direction: "desc",
    });

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.sort).toEqual({
      columnId: "metric:incoming_deals_count.current",
      direction: "desc",
    });
  });

  it("setColumnWidth persists the merged columnWidths map", async () => {
    useReportPrefsStore
      .getState()
      .setColumnWidth("by-managers", "manager_name", 220);
    useReportPrefsStore
      .getState()
      .setColumnWidth("by-managers", "incoming_deals_count", 140);

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.columnWidths).toEqual({
      manager_name: 220,
      incoming_deals_count: 140,
    });
  });

  it("setColumnOrder persists the new column order", async () => {
    useReportPrefsStore
      .getState()
      .setColumnOrder("by-managers", ["manager_name", "incoming_deals_count"]);

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.columnOrder).toEqual([
      "manager_name",
      "incoming_deals_count",
    ]);
  });

  it("setHiddenColumns persists the new hidden-columns list", async () => {
    useReportPrefsStore
      .getState()
      .setHiddenColumns("by-managers", ["won_deals_amount"]);

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.hiddenColumns).toEqual(["won_deals_amount"]);
  });

  it("collapses a rapid burst of setter calls into a single write", async () => {
    const setColumnWidth = useReportPrefsStore.getState().setColumnWidth;

    // Simulate a column-resize drag: many writes inside the debounce
    // window. Each schedule should reset the timer.
    setColumnWidth("by-managers", "manager_name", 100);
    vi.advanceTimersByTime(50);
    setColumnWidth("by-managers", "manager_name", 150);
    vi.advanceTimersByTime(50);
    setColumnWidth("by-managers", "manager_name", 200);

    // Total elapsed: 100 ms. Still inside the debounce — nothing
    // written yet.
    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-managers"),
    ).toBeNull();

    await flushDebounce();

    const stored = readStored("bi.prefs.local.sales.by-managers");
    expect(stored?.columnWidths).toEqual({ manager_name: 200 });
  });
});

// ---------------------------------------------------------------------------
// Namespacing across slugs and userKeys
// ---------------------------------------------------------------------------

describe("namespace isolation", () => {
  it("different slugs persist to different storage keys", async () => {
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["managers_metric"]);
    useReportPrefsStore
      .getState()
      .setMetricIds("by-product-groups", ["pg_metric"]);

    await flushDebounce();

    const keys = Object.keys(window.localStorage).sort();
    expect(keys).toEqual([
      "bi.prefs.local.sales.by-managers",
      "bi.prefs.local.sales.by-product-groups",
    ]);

    expect(
      readStored("bi.prefs.local.sales.by-managers")?.metricIds,
    ).toEqual(["managers_metric"]);
    expect(
      readStored("bi.prefs.local.sales.by-product-groups")?.metricIds,
    ).toEqual(["pg_metric"]);
  });

  it("setUserKey swaps the storage namespace; later persists go under the new key", async () => {
    // Initial userKey = "local". A first persist lands at the local key.
    useReportPrefsStore
      .getState()
      .setMetricIds("by-managers", ["before_swap"]);
    await flushDebounce();
    expect(
      readStored("bi.prefs.local.sales.by-managers")?.metricIds,
    ).toEqual(["before_swap"]);

    // Swap user.
    useReportPrefsStore.getState().setUserKey("alice");

    // Subsequent persist must land under the new user key, NOT "local".
    useReportPrefsStore.getState().setMetricIds("by-managers", ["after_swap"]);
    await flushDebounce();

    expect(
      readStored("bi.prefs.alice.sales.by-managers")?.metricIds,
    ).toEqual(["after_swap"]);
    // The old "local" record stays untouched (setUserKey doesn't clear).
    expect(
      readStored("bi.prefs.local.sales.by-managers")?.metricIds,
    ).toEqual(["before_swap"]);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe("reset(slug)", () => {
  it("clears the persisted record for that slug", async () => {
    useReportPrefsStore.getState().setGrouping("by-managers", "team");
    await flushDebounce();
    // Sanity: the persist landed.
    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-managers"),
    ).not.toBeNull();

    useReportPrefsStore.getState().reset("by-managers");
    // `reset` clears synchronously through the repository — no debounce.
    await Promise.resolve();

    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-managers"),
    ).toBeNull();
  });

  it("does not touch other slugs' persisted records", async () => {
    useReportPrefsStore.getState().setGrouping("by-managers", "team");
    useReportPrefsStore.getState().setGrouping("by-product-groups", "total");
    await flushDebounce();

    useReportPrefsStore.getState().reset("by-managers");
    await Promise.resolve();

    expect(
      readStored("bi.prefs.local.sales.by-product-groups")?.grouping,
    ).toBe("total");
  });

  it("cancels a pending debounced persist for the slug", async () => {
    useReportPrefsStore.getState().setGrouping("by-managers", "team");

    // Reset BEFORE the debounce window elapses.
    useReportPrefsStore.getState().reset("by-managers");
    await flushDebounce();

    // The cancelled persist must not have written the pre-reset value.
    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-managers"),
    ).toBeNull();
  });
});
