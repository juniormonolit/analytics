import {
  Megaphone,
  Settings,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ReportConfig = {
  slug: string;
  label: string;
  href: string;
};

export type SectionConfig = {
  slug: string;
  label: string;
  icon: LucideIcon;
  href: string;
  disabled: boolean;
  reports?: readonly ReportConfig[];
};

export const SECTIONS: readonly SectionConfig[] = [
  {
    slug: "hr",
    label: "Найм",
    icon: Users,
    href: "/hr",
    disabled: true,
  },
  {
    slug: "marketing",
    label: "Маркетинг",
    icon: Megaphone,
    href: "/marketing",
    disabled: true,
  },
  {
    slug: "sales",
    label: "Продажи",
    icon: TrendingUp,
    href: "/sales",
    disabled: false,
    reports: [
      {
        slug: "by-managers",
        label: "По менеджерам",
        href: "/sales/by-managers",
      },
      {
        slug: "by-product-groups",
        label: "По товарным группам",
        href: "/sales/by-product-groups",
      },
    ],
  },
  {
    slug: "delivery",
    label: "Реализация",
    icon: Truck,
    href: "/delivery",
    disabled: true,
  },
];

export const SETTINGS: SectionConfig = {
  slug: "settings",
  label: "Настройки",
  icon: Settings,
  href: "/settings",
  disabled: false,
};

const salesSection = SECTIONS.find((section) => section.slug === "sales");
if (!salesSection?.reports) {
  throw new Error(
    "Navigation config error: 'sales' section must declare a reports array.",
  );
}

export const SALES_REPORTS: readonly ReportConfig[] = salesSection.reports;
