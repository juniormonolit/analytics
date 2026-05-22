"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useSalesReportNavItems } from "@/features/sales/hooks/useSalesReportNav";
import { isSavedReportSetHrefActive } from "@/features/sales/reportSets/urls";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";

/**
 * Pill-style tabs that switch between reports inside the Sales section.
 */
export function ReportTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSetId = searchParams.get("set");
  const navItems = useSalesReportNavItems();
  const hydrateSets = useReportSetsStore((state) => state.hydrate);

  useEffect(() => {
    void hydrateSets();
  }, [hydrateSets]);

  return (
    <nav
      aria-label="Отчёты раздела"
      className="flex flex-wrap items-center gap-2 border-b border-border-primary bg-bg-primary px-6 py-3"
    >
      {navItems.map((item) => {
        const isActive =
          item.kind === "saved" && item.setId
            ? isSavedReportSetHrefActive(
                pathname,
                item.setId,
                item.reportSlug,
                activeSetId,
              )
            : pathname === item.href && !activeSetId;

        return (
          <Link
            key={item.slug}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              item.kind === "saved"
                ? isActive
                  ? "border border-accent-primary bg-accent-soft text-accent-primary"
                  : "border border-dashed border-border-primary text-text-secondary hover:text-text-primary"
                : isActive
                  ? "border border-border-primary bg-bg-card text-text-primary"
                  : "border border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
