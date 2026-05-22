import type { SavedReportSet } from "@/features/sales/reportSets/types";

import type { ReportSetsRepoKey, ReportSetsRepository } from "./ReportSetsRepository";

type StoredPayload = {
  setsVersion: number;
  sets: SavedReportSet[];
};

export class LocalStorageReportSetsRepository implements ReportSetsRepository {
  private static readonly STORAGE_KEY_PREFIX = "bi.reportSets";
  private static readonly CURRENT_VERSION = 1;

  private storageKey(key: ReportSetsRepoKey): string {
    return `${LocalStorageReportSetsRepository.STORAGE_KEY_PREFIX}.${key.userKey}.${key.sectionSlug}`;
  }

  private isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  }

  async list(key: ReportSetsRepoKey): Promise<SavedReportSet[]> {
    if (!this.isAvailable()) return [];
    try {
      const raw = window.localStorage.getItem(this.storageKey(key));
      if (raw === null) return [];
      const parsed = JSON.parse(raw) as StoredPayload;
      if (parsed.setsVersion !== LocalStorageReportSetsRepository.CURRENT_VERSION) {
        return [];
      }
      return Array.isArray(parsed.sets) ? parsed.sets : [];
    } catch {
      return [];
    }
  }

  async save(key: ReportSetsRepoKey, sets: SavedReportSet[]): Promise<void> {
    if (!this.isAvailable()) return;
    const payload: StoredPayload = {
      setsVersion: LocalStorageReportSetsRepository.CURRENT_VERSION,
      sets,
    };
    try {
      window.localStorage.setItem(this.storageKey(key), JSON.stringify(payload));
    } catch {
      // ignore quota / security errors
    }
  }
}
