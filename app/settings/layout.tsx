import { type ReactNode } from "react";

import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { SectionHeader } from "@/components/shell/SectionHeader";

type SettingsLayoutProps = {
  children: ReactNode;
};

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        title="Настройки"
        subtitle="Internal debug: sa-таблицы, метрики и org-структура с сотрудниками"
      />
      <SettingsTabs />
      <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
