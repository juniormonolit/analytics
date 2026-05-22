"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSalesReportNavItems } from "@/features/sales/hooks/useSalesReportNav";
import { isSavedReportSetHrefActive } from "@/features/sales/reportSets/urls";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";
import { SECTIONS, SETTINGS } from "@/lib/navigation/sections";
import { SidebarItem } from "./SidebarItem";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

function isSectionActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Left navigation rail. Owns its own "Sales submenu expanded" state but
 * receives the collapse state from the parent `AppShell` so it can be
 * persisted across reloads via `useCollapsedSidebar`.
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSetId = searchParams.get("set");
  const navItems = useSalesReportNavItems();
  const hydrateSets = useReportSetsStore((state) => state.hydrate);

  useEffect(() => {
    void hydrateSets();
  }, [hydrateSets]);

  // "Adjust state during render" pattern: when the URL changes into /sales,
  // ensure the Sales submenu is expanded without resorting to setState
  // inside an effect. See https://react.dev/learn/you-might-not-need-an-effect.
  const [salesExpanded, setSalesExpanded] = useState<boolean>(() =>
    pathname?.startsWith("/sales") ?? false,
  );
  const [trackedPathname, setTrackedPathname] = useState<string | null>(
    pathname ?? null,
  );
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname ?? null);
    if (pathname?.startsWith("/sales") && !salesExpanded) {
      setSalesExpanded(true);
    }
  }

  return (
    <aside
      aria-label="Главная навигация"
      className={`flex h-full shrink-0 flex-col border-r border-border-primary bg-bg-card transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-primary px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border-primary bg-bg-primary">
            <Image
              src="/smekalochnaya_logo.png"
              alt="Смекалочная"
              width={32}
              height={32}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          {!collapsed && (
            <span className="min-w-0 truncate text-sm font-semibold text-text-primary">
              Смекалочная
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          aria-pressed={collapsed}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav
        aria-label="Разделы"
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
      >
        <ul className="flex flex-col gap-1">
          {SECTIONS.map((section) => {
            const sectionActive =
              !section.disabled && isSectionActive(pathname, section.href);
            const isSales = section.slug === "sales";
            const showSubMenu =
              isSales && !collapsed && salesExpanded && section.reports;

            return (
              <li key={section.slug}>
                <SidebarItem
                  icon={section.icon}
                  label={section.label}
                  href={section.disabled ? undefined : section.href}
                  disabled={section.disabled}
                  active={sectionActive}
                  collapsed={collapsed}
                  expandable={isSales}
                  expanded={isSales ? salesExpanded : false}
                  onExpandToggle={
                    isSales ? () => setSalesExpanded((v) => !v) : undefined
                  }
                />
                {showSubMenu && (
                  <ul
                    aria-label={`Отчёты раздела «${section.label}»`}
                    className="mt-1 ml-9 flex flex-col gap-0.5"
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
                        <li key={item.slug}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                              item.kind === "saved"
                                ? isActive
                                  ? "bg-accent-soft text-accent-primary"
                                  : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                                : isActive
                                  ? "bg-accent-soft text-accent-primary"
                                  : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-border-primary p-2">
        <div
          className={`flex ${collapsed ? "justify-center" : "justify-end px-1"}`}
        >
          <ThemeToggle />
        </div>
        <SidebarItem
          icon={SETTINGS.icon}
          label={SETTINGS.label}
          href={SETTINGS.disabled ? undefined : SETTINGS.href}
          disabled={SETTINGS.disabled}
          active={
            !SETTINGS.disabled && isSectionActive(pathname, SETTINGS.href)
          }
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
