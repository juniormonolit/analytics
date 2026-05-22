/**
 * Public entry point for the report-preferences repository.
 *
 * Call sites import the singleton + types from THIS file only — never
 * from `LocalStorageReportPreferencesRepository` directly. That keeps
 * the future Supabase-backed implementation a one-line swap (just
 * change which class is constructed below) and prevents accidental
 * `instanceof` coupling in consumer code.
 */
import { LocalStorageReportPreferencesRepository } from "./LocalStorageReportPreferencesRepository";
import type { ReportPreferencesRepository } from "./ReportPreferencesRepository";

export type {
  ReportPreferences,
  RepoKey,
  SortDirection,
  SortState,
  Grouping,
} from "./types";
export type { ReportPreferencesRepository } from "./ReportPreferencesRepository";

export const reportPreferencesRepository: ReportPreferencesRepository =
  new LocalStorageReportPreferencesRepository();
