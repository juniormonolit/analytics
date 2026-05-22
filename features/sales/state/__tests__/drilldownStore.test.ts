/**
 * Tests for `features/sales/state/drilldownStore.ts`.
 *
 * The store is a tiny Zustand singleton that drives the drill-down
 * panel's history stack. Each test resets it back to its initial
 * snapshot so cases stay independent.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  selectCurrentEntry,
  useDrilldownStore,
  type DrilldownStackEntry,
} from "../drilldownStore";

const makeEntry = (
  overrides: Partial<DrilldownStackEntry> = {},
): DrilldownStackEntry => ({
  level: "product-groups",
  rowKey: { managerId: 1 },
  label: "Менеджер 1",
  ...overrides,
});

beforeEach(() => {
  useDrilldownStore.setState({
    open: false,
    reportSlug: null,
    stack: [],
  });
});

describe("drilldownStore — initial state", () => {
  it("starts closed, with no reportSlug and an empty stack", () => {
    const s = useDrilldownStore.getState();
    expect(s.open).toBe(false);
    expect(s.reportSlug).toBeNull();
    expect(s.stack).toEqual([]);
  });
});

describe("openFromRow()", () => {
  it("opens the panel, sets reportSlug and seeds the stack with a single entry", () => {
    const entry = makeEntry({
      level: "product-groups",
      rowKey: { managerId: 7 },
      label: "Анна",
    });
    useDrilldownStore.getState().openFromRow("by-managers", entry);

    const s = useDrilldownStore.getState();
    expect(s.open).toBe(true);
    expect(s.reportSlug).toBe("by-managers");
    expect(s.stack).toEqual([entry]);
  });

  it("replaces a previous stack with a fresh single-entry stack on re-open", () => {
    useDrilldownStore.getState().openFromRow("by-managers", makeEntry());
    useDrilldownStore.getState().push(
      makeEntry({ level: "deals", label: "Сделки" }),
    );
    expect(useDrilldownStore.getState().stack).toHaveLength(2);

    const newEntry = makeEntry({
      level: "managers",
      rowKey: { productGroupId: 5 },
      label: "Группа",
    });
    useDrilldownStore.getState().openFromRow("by-product-groups", newEntry);

    const s = useDrilldownStore.getState();
    expect(s.reportSlug).toBe("by-product-groups");
    expect(s.stack).toEqual([newEntry]);
  });
});

describe("push()", () => {
  it("appends a new entry to the end of the stack", () => {
    const first = makeEntry({ label: "first" });
    const second = makeEntry({ level: "deals", label: "second" });

    useDrilldownStore.getState().openFromRow("by-managers", first);
    useDrilldownStore.getState().push(second);

    expect(useDrilldownStore.getState().stack).toEqual([first, second]);
  });

  it("preserves open=true and the reportSlug", () => {
    useDrilldownStore.getState().openFromRow(
      "by-managers",
      makeEntry({ label: "a" }),
    );
    useDrilldownStore.getState().push(makeEntry({ label: "b" }));

    const s = useDrilldownStore.getState();
    expect(s.open).toBe(true);
    expect(s.reportSlug).toBe("by-managers");
  });
});

describe("pop()", () => {
  it("removes the top entry when stack length > 1", () => {
    const a = makeEntry({ label: "a" });
    const b = makeEntry({ label: "b" });
    useDrilldownStore.getState().openFromRow("by-managers", a);
    useDrilldownStore.getState().push(b);

    useDrilldownStore.getState().pop();

    const s = useDrilldownStore.getState();
    expect(s.stack).toEqual([a]);
    expect(s.open).toBe(true);
    expect(s.reportSlug).toBe("by-managers");
  });

  it("closes the panel and clears reportSlug when popping the last entry", () => {
    useDrilldownStore.getState().openFromRow(
      "by-managers",
      makeEntry({ label: "only" }),
    );

    useDrilldownStore.getState().pop();

    const s = useDrilldownStore.getState();
    expect(s.stack).toEqual([]);
    expect(s.open).toBe(false);
    expect(s.reportSlug).toBeNull();
  });

  it("is safe to call when the stack is already empty", () => {
    useDrilldownStore.getState().pop();
    const s = useDrilldownStore.getState();
    expect(s.stack).toEqual([]);
    expect(s.open).toBe(false);
  });
});

describe("popTo()", () => {
  it("truncates the stack to length index+1", () => {
    const a = makeEntry({ label: "a" });
    const b = makeEntry({ label: "b" });
    const c = makeEntry({ label: "c" });
    useDrilldownStore.getState().openFromRow("by-managers", a);
    useDrilldownStore.getState().push(b);
    useDrilldownStore.getState().push(c);

    useDrilldownStore.getState().popTo(0);
    expect(useDrilldownStore.getState().stack).toEqual([a]);

    useDrilldownStore.getState().push(b);
    useDrilldownStore.getState().push(c);
    useDrilldownStore.getState().popTo(1);
    expect(useDrilldownStore.getState().stack).toEqual([a, b]);
  });

  it("is a no-op when index is negative", () => {
    const a = makeEntry({ label: "a" });
    const b = makeEntry({ label: "b" });
    useDrilldownStore.getState().openFromRow("by-managers", a);
    useDrilldownStore.getState().push(b);

    useDrilldownStore.getState().popTo(-1);
    expect(useDrilldownStore.getState().stack).toEqual([a, b]);
  });

  it("is a no-op when index >= stack.length", () => {
    const a = makeEntry({ label: "a" });
    useDrilldownStore.getState().openFromRow("by-managers", a);

    useDrilldownStore.getState().popTo(5);
    expect(useDrilldownStore.getState().stack).toEqual([a]);
  });
});

describe("close()", () => {
  it("clears open, reportSlug and the stack", () => {
    useDrilldownStore.getState().openFromRow("by-managers", makeEntry());
    useDrilldownStore.getState().push(makeEntry({ level: "deals" }));

    useDrilldownStore.getState().close();

    const s = useDrilldownStore.getState();
    expect(s.open).toBe(false);
    expect(s.reportSlug).toBeNull();
    expect(s.stack).toEqual([]);
  });
});

describe("selectCurrentEntry", () => {
  it("returns null when the stack is empty", () => {
    expect(selectCurrentEntry(useDrilldownStore.getState())).toBeNull();
  });

  it("returns the last stack entry", () => {
    const a = makeEntry({ label: "a" });
    const b = makeEntry({ label: "b" });
    useDrilldownStore.getState().openFromRow("by-managers", a);
    useDrilldownStore.getState().push(b);

    expect(selectCurrentEntry(useDrilldownStore.getState())).toEqual(b);
  });
});
