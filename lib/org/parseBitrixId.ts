export function parseBitrixUserId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bitrixUserIdToQueryValues(ids: readonly number[]): string[] {
  return ids.map((id) => String(id));
}
