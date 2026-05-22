import type { Metadata } from "next";

import { SettingsTabSuspense } from "@/components/settings/SettingsTabSuspense";
import { TablesTabContent } from "@/components/settings/TablesTabContent";

export const metadata: Metadata = {
  title: "Таблицы — Настройки",
};

export default function SettingsTablesPage() {
  return (
    <SettingsTabSuspense>
      <TablesTabContent />
    </SettingsTabSuspense>
  );
}
