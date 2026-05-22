import { SettingsTabSuspense } from "@/components/settings/SettingsTabSuspense";
import { OrgStructureTabContent } from "@/components/settings/OrgStructureTabContent";

export const metadata = {
  title: "Оргструктура — Настройки",
};

export default function SettingsOrgPage() {
  return (
    <SettingsTabSuspense>
      <OrgStructureTabContent />
    </SettingsTabSuspense>
  );
}
