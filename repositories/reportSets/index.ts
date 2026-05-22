import { AccountReportSetsRepository } from "./AccountReportSetsRepository";

export type { ReportSetsRepository, ReportSetsRepoKey } from "./ReportSetsRepository";

export const reportSetsRepository = new AccountReportSetsRepository();
