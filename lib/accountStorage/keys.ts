export const ACCOUNT_STORAGE_KEYS = {
  metricColorSettings: "metricColorSettings",
  reportSets: (sectionSlug: string) => `reportSets.${sectionSlug}`,
} as const;

export type AccountStorageEnvelope<T> = {
  version: number;
  data: T;
};

export function wrapAccountPayload<T>(data: T, version = 1): AccountStorageEnvelope<T> {
  return { version, data };
}

export function unwrapAccountPayload<T>(
  payload: unknown,
): T | null {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as AccountStorageEnvelope<T>;
  if (!("data" in envelope)) return payload as T;
  return envelope.data;
}
