"use client";

import { useEffect } from "react";

import { useReportPrefsStore } from "@/features/sales/state/reportPrefsStore";
import { useReportSetsStore } from "@/features/sales/state/reportSetsStore";
import { useMetricColorSettingsStore } from "@/features/reports/metricColorSettings/metricColorSettingsStore";

export function AccountBootstrap() {
  useEffect(() => {
    async function bootstrap() {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) return;
        const json = (await response.json()) as {
          user?: { userKey: string };
        };
        const userKey = json.user?.userKey;
        if (!userKey) return;

        useReportPrefsStore.getState().setUserKey(userKey);
        useReportSetsStore.getState().setUserKey(userKey);
        useMetricColorSettingsStore.getState().setUserKey(userKey);

        await Promise.all([
          useReportSetsStore.getState().hydrate(),
          useMetricColorSettingsStore.getState().hydrate(),
        ]);
      } catch {
        // Offline / unauthenticated — local defaults remain.
      }
    }

    void bootstrap();
  }, []);

  return null;
}
