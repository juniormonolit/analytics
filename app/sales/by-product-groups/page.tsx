import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportPageContent } from "@/components/reports/ReportPageContent";

export const metadata: Metadata = {
  title: "Продажи — По товарным группам",
};

export default function SalesByProductGroupsPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageContent reportSlug="by-product-groups" />
    </Suspense>
  );
}
