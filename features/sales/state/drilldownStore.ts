"use client";

/**
 * Zustand store backing `<DrillDownPanel />`.
 *
 * The panel's behavior is driven by a stack of "where am I?" entries:
 *   - The bottom of the stack is the row the user clicked in the main
 *     table (e.g. a manager from `by-managers`).
 *   - Each subsequent push deepens the drill (e.g. into a product
 *     group inside that manager, then into its deals).
 *   - `pop()` walks back one level; `popTo(index)` truncates the
 *     stack so a breadcrumb click jumps directly to that level.
 *   - `close()` empties the stack and hides the panel.
 *
 * The store also remembers which `reportSlug` opened the panel so
 * the level table can dispatch to the right handler without having
 * to re-derive it from the current URL.
 */
import { create } from "zustand";

import type {
  DrilldownStackEntry,
} from "@/features/reports/drilldown/types";
import type { ReportSlug } from "@/features/reports/engine/types";

export type { DrilldownStackEntry } from "@/features/reports/drilldown/types";

export type DrilldownState = {
  open: boolean;
  reportSlug: ReportSlug | null;
  stack: DrilldownStackEntry[];

  /**
   * Open the panel from a top-level table row click. Resets the
   * stack to a single entry so re-clicking another row swaps cleanly.
   */
  openFromRow: (slug: ReportSlug, entry: DrilldownStackEntry) => void;
  /** Push a deeper level onto the stack. */
  push: (entry: DrilldownStackEntry) => void;
  /** Pop the top of the stack. Closes the panel if the stack would empty. */
  pop: () => void;
  /**
   * Truncate the stack to length `index + 1` (i.e. jump back to the
   * breadcrumb at position `index`). No-op when `index` is invalid.
   */
  popTo: (index: number) => void;
  /** Close the panel and clear the stack entirely. */
  close: () => void;
};

export const useDrilldownStore = create<DrilldownState>((set) => ({
  open: false,
  reportSlug: null,
  stack: [],

  openFromRow: (slug, entry) =>
    set({ open: true, reportSlug: slug, stack: [entry] }),

  push: (entry) =>
    set((state) => ({ stack: [...state.stack, entry] })),

  pop: () =>
    set((state) => {
      if (state.stack.length <= 1) {
        return { open: false, stack: [], reportSlug: null };
      }
      return { stack: state.stack.slice(0, -1) };
    }),

  popTo: (index) =>
    set((state) => {
      if (index < 0 || index >= state.stack.length) return state;
      return { stack: state.stack.slice(0, index + 1) };
    }),

  close: () => set({ open: false, stack: [], reportSlug: null }),
}));

/** Currently-active stack entry — what the body should render. */
export function selectCurrentEntry(
  state: DrilldownState,
): DrilldownStackEntry | null {
  return state.stack.length > 0
    ? state.stack[state.stack.length - 1]
    : null;
}
