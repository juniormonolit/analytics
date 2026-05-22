import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportPageContent } from "@/components/reports/ReportPageContent";

export const metadata: Metadata = {
  title: "Продажи — По менеджерам",
};

export default function SalesByManagersPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageContent reportSlug="by-managers" />
    </Suspense>
  );
}
