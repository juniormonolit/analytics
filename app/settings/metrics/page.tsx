import type { Metadata } from "next";

import { MetricsTabContent } from "@/components/settings/MetricsTabContent";
import { SettingsTabSuspense } from "@/components/settings/SettingsTabSuspense";

export const metadata: Metadata = {
  title: "Метрики — Настройки",
};

export default function SettingsMetricsPage() {
  return (
    <SettingsTabSuspense>
      <MetricsTabContent />
    </SettingsTabSuspense>
  );
}
