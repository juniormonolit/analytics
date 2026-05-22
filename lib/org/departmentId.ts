import { z } from "zod";

export type DepartmentId = string;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDepartmentId(value: string): value is DepartmentId {
  return UUID_RE.test(value);
}

/** Zod validator for org department UUIDs in API request bodies. */
export function departmentIdSchema() {
  return z
    .string()
    .regex(UUID_RE, "must be a valid department UUID");
}

export function parseDepartmentIds(raw: string | null): DepartmentId[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => isDepartmentId(part));
}
