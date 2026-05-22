import type { DateString, Period } from "@/lib/period/types";

export function orderRange(a: DateString, b: DateString): Period {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export const RANGE_PICKER_TRIGGER_CLASS =
  "inline-flex h-8 items-center gap-2 rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary transition-colors hover:border-input-border-hover";
