"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_TABS = [
  { slug: "tables", label: "Таблицы", href: "/settings/tables" },
  { slug: "metrics", label: "Метрики", href: "/settings/metrics" },
  { slug: "org", label: "Оргструктура", href: "/settings/org" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы настроек"
      className="flex items-center gap-2 border-b border-border-primary bg-bg-primary px-6 py-3"
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.slug}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              isActive
                ? "border border-border-primary bg-bg-card text-text-primary"
                : "border border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
