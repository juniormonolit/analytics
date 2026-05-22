import { Suspense, type ReactNode } from "react";

import { TableSkeleton } from "@/components/reports/states/TableSkeleton";

export function SettingsTabFallback() {
  return <TableSkeleton />;
}

export function SettingsTabSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SettingsTabFallback />}>{children}</Suspense>;
}
