import type { SavedReportSet } from "@/features/sales/reportSets/types";

export type ReportSetsRepoKey = {
  userKey: string;
  sectionSlug: string;
};

export interface ReportSetsRepository {
  list(key: ReportSetsRepoKey): Promise<SavedReportSet[]>;
  save(key: ReportSetsRepoKey, sets: SavedReportSet[]): Promise<void>;
}
