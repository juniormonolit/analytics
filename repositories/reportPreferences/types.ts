/**
 * Shared types for the user-preferences repository.
 *
 * The repository persists per-(user, section, report) UI state — which
 * metrics the user picked, how columns are ordered/hidden/sized, and
 * the active grouping + sort. The shape mirrors the example given in
 * `ai_docs/02_DATABASE_AND_SUPABASE.md` so the future Supabase-backed
 * implementation can store the same JSON in
 * `sa.user_report_preferences.preferences` without translation.
 *
 * `Grouping` is re-exported from the report engine because there is
 * exactly one canonical type for it across the app — the prefs
 * repository must use the same string union as the API.
 */
import type { Grouping, DealScope } from "@/features/reports/engine/types";

export type { Grouping };

export type SortDirection = "asc" | "desc";

export type SortState = {
  /**
   * Stable column id, e.g. `dimension:manager_name` or
   * `metric:incoming_deals_count.current`.
   */
  columnId: string;
  direction: SortDirection;
} | null;

/**
 * The full persisted shape. All fields are required in storage; the
 * repository accepts and returns `Partial<ReportPreferences>` so a UI
 * surface that only owns one field (e.g. column resize) doesn't have
 * to know about the others.
 */
export type ReportPreferences = {
  metricIds: string[];
  columnOrder: string[];
  hiddenColumns: string[];
  columnWidths: Record<string, number>;
  grouping: Grouping;
  dealScope?: DealScope;
  sort: SortState;
};

/**
 * Composite key identifying a single preferences record.
 *
 * `userKey` is `"local"` while there's no auth; once auth lands it
 * becomes the auth user id and the same code path keeps working.
 */
export type RepoKey = {
  userKey: string;
  sectionSlug: string;
  reportSlug: string;
};
