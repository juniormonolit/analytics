import { Suspense, type ReactNode } from "react";

import { DrillDownPanel } from "@/components/reports/DrillDownPanel";
import { FilterBar } from "@/components/filters/FilterBar";
import { FilterBarFallback } from "@/components/filters/FilterBarFallback";
import { ReportTabs } from "@/components/shell/ReportTabs";
import { SectionHeader } from "@/components/shell/SectionHeader";

type SalesLayoutProps = {
  children: ReactNode;
};

export default function SalesLayout({ children }: SalesLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Продажи" />
      {/*
        FilterBar uses `useSearchParams` for URL ↔ store sync. Next.js
        requires that hook to live inside a Suspense boundary so static
        prerendering can opt out of the dynamic subtree without
        breaking the rest of the page.
      */}
      <Suspense fallback={<FilterBarFallback />}>
        <FilterBar />
      </Suspense>
      <Suspense fallback={null}>
        <ReportTabs />
      </Suspense>
      <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
      {/*
        Mounted once at the section level so the drill-down panel
        overlays any sales report. Visibility is driven by
        `useDrilldownStore.open`.
      */}
      <DrillDownPanel />
    </div>
  );
}
