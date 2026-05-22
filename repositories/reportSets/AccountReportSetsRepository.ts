import {
  ACCOUNT_STORAGE_KEYS,
  unwrapAccountPayload,
  wrapAccountPayload,
} from "@/lib/accountStorage/keys";
import type { SavedReportSet } from "@/features/sales/reportSets/types";

import type { ReportSetsRepoKey, ReportSetsRepository } from "./ReportSetsRepository";
import { LocalStorageReportSetsRepository } from "./LocalStorageReportSetsRepository";

type StoredPayload = {
  setsVersion: number;
  sets: SavedReportSet[];
};

const CURRENT_VERSION = 1;

export class AccountReportSetsRepository implements ReportSetsRepository {
  private readonly local = new LocalStorageReportSetsRepository();

  private storageKey(sectionSlug: string): string {
    return ACCOUNT_STORAGE_KEYS.reportSets(sectionSlug);
  }

  private serialize(sets: SavedReportSet[]): unknown {
    const payload: StoredPayload = {
      setsVersion: CURRENT_VERSION,
      sets,
    };
    return wrapAccountPayload(payload);
  }

  private deserialize(payload: unknown): SavedReportSet[] {
    const unwrapped = unwrapAccountPayload<StoredPayload>(payload);
    const data = unwrapped ?? (payload as StoredPayload | null);
    if (!data || data.setsVersion !== CURRENT_VERSION) return [];
    return Array.isArray(data.sets) ? data.sets : [];
  }

  async list(key: ReportSetsRepoKey): Promise<SavedReportSet[]> {
    const storageKey = this.storageKey(key.sectionSlug);
    try {
      const response = await fetch(
        `/api/account/storage/${encodeURIComponent(storageKey)}`,
      );
      if (response.status === 401) {
        return this.local.list(key);
      }
      if (!response.ok) {
        return this.local.list(key);
      }
      const json = (await response.json()) as { payload?: unknown };
      if (!json.payload) return [];
      const sets = this.deserialize(json.payload);
      await this.local.save(key, sets);
      return sets;
    } catch {
      return this.local.list(key);
    }
  }

  async save(key: ReportSetsRepoKey, sets: SavedReportSet[]): Promise<void> {
    await this.local.save(key, sets);
    const storageKey = this.storageKey(key.sectionSlug);
    try {
      await fetch(`/api/account/storage/${encodeURIComponent(storageKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: this.serialize(sets) }),
      });
    } catch {
      // Local cache already updated.
    }
  }
}
