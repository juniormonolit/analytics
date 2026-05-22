"use client";

/**
 * Sales-section FilterBar.
 *
 * Composes the section-level filter controls (date range + departments)
 * and mounts the URL-sync hook in a single client subtree. The hook
 * lives here — not in the layout — because the layout is a server
 * component and `useSyncFiltersWithUrl` reads/writes browser-only
 * APIs (`useRouter`, `useSearchParams`).
 */
import { ComparisonRangePicker } from "./ComparisonRangePicker";
import { PeriodRangePicker } from "./PeriodRangePicker";
import { DepartmentTreeFilter } from "./DepartmentTreeFilter";
import { useSyncFiltersWithUrl } from "@/features/sales/state/useSyncFiltersWithUrl";

export function FilterBar() {
  useSyncFiltersWithUrl();

  return (
    <div className="flex items-center gap-2 border-b border-border-primary bg-bg-card px-6 py-3">
      <PeriodRangePicker />
      <ComparisonRangePicker />
      <DepartmentTreeFilter />
    </div>
  );
}
