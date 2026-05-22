/**
 * Browser-side preferences repository backed by `window.localStorage`.
 *
 * Storage layout:
 *   key   = `bi.prefs.<userKey>.<sectionSlug>.<reportSlug>`
 *   value = JSON-stringified `Partial<ReportPreferences> & { prefsVersion }`
 *
 * The `prefsVersion` field is an internal-only schema marker — it is
 * stripped on read so callers see a clean `Partial<ReportPreferences>`.
 * If a stored record's version doesn't match `CURRENT_VERSION` we drop
 * it (v1 has no migrations to perform); future versions can plug in a
 * migration step at the same point.
 *
 * All operations are SSR-safe: when `window` / `window.localStorage`
 * is unavailable, reads return `null` and writes/clears no-op. They
 * also swallow exceptions (`QuotaExceededError`, JSON parse errors,
 * `SecurityError` in private modes) so a corrupted record can never
 * crash the UI — the user just sees the defaults.
 */
import type { ReportPreferencesRepository } from "./ReportPreferencesRepository";
import type { ReportPreferences, RepoKey } from "./types";

type StoredPayload = Partial<ReportPreferences> & { prefsVersion?: number };

export class LocalStorageReportPreferencesRepository
  implements ReportPreferencesRepository
{
  private static readonly STORAGE_KEY_PREFIX = "bi.prefs";
  private static readonly CURRENT_VERSION = 1;

  private storageKey(key: RepoKey): string {
    return `${LocalStorageReportPreferencesRepository.STORAGE_KEY_PREFIX}.${key.userKey}.${key.sectionSlug}.${key.reportSlug}`;
  }

  private isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  }

  async get(key: RepoKey): Promise<Partial<ReportPreferences> | null> {
    if (!this.isAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(this.storageKey(key));
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as StoredPayload;
      if (
        parsed.prefsVersion !==
        LocalStorageReportPreferencesRepository.CURRENT_VERSION
      ) {
        // v1: drop unrecognized versions. Future impl: migrate here.
        return null;
      }
      const { prefsVersion: _prefsVersion, ...prefs } = parsed;
      void _prefsVersion;
      return prefs;
    } catch {
      return null;
    }
  }

  async save(
    key: RepoKey,
    prefs: Partial<ReportPreferences>,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const payload: StoredPayload = {
      ...prefs,
      prefsVersion: LocalStorageReportPreferencesRepository.CURRENT_VERSION,
    };
    try {
      window.localStorage.setItem(
        this.storageKey(key),
        JSON.stringify(payload),
      );
    } catch {
      // QuotaExceeded / SecurityError — ignore: a missed persist is
      // recoverable; a thrown error from a UI handler is not.
    }
  }

  async update(
    key: RepoKey,
    patch: Partial<ReportPreferences>,
  ): Promise<void> {
    const existing = (await this.get(key)) ?? {};
    const merged: Partial<ReportPreferences> = { ...existing, ...patch };
    await this.save(key, merged);
  }

  async clear(key: RepoKey): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(this.storageKey(key));
    } catch {
      // ignore
    }
  }
}
