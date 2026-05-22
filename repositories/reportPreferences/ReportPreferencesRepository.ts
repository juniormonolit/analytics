/**
 * Repository contract for user report preferences.
 *
 * Methods return `Promise<void>` (or `Promise<Partial<ReportPreferences> | null>`
 * for `get`) so the same interface can be backed by an asynchronous
 * data source — e.g. the planned `SupabaseReportPreferencesRepository`
 * against `sa.user_report_preferences` — without forcing call sites to
 * change.
 *
 *  - `save` is a full replace.
 *  - `update` is a partial merge with the existing record (it reads,
 *    merges, then writes).
 *  - `Partial<ReportPreferences>` is accepted because not every UI
 *    surface owns every field (e.g. column resize only writes
 *    `columnWidths`).
 */
import type { ReportPreferences, RepoKey } from "./types";

export interface ReportPreferencesRepository {
  /** Read the stored prefs (or `null` if there are none). */
  get(key: RepoKey): Promise<Partial<ReportPreferences> | null>;
  /** Replace the stored record with `prefs`. */
  save(key: RepoKey, prefs: Partial<ReportPreferences>): Promise<void>;
  /** Merge `patch` over the existing record (read-modify-write). */
  update(key: RepoKey, patch: Partial<ReportPreferences>): Promise<void>;
  /** Remove the stored record entirely. */
  clear(key: RepoKey): Promise<void>;
}
