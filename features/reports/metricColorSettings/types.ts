export const GRADIENT_PALETTE = [
  { id: "green", label: "Зелёный", bg: "#dcfce7", text: "#166534" },
  { id: "yellow", label: "Жёлтый", bg: "#fef3c7", text: "#92400e" },
  { id: "orange", label: "Оранжевый", bg: "#ffedd5", text: "#9a3412" },
  { id: "red", label: "Красный", bg: "#fee2e2", text: "#991b1b" },
  { id: "blue", label: "Синий", bg: "#dbeafe", text: "#1e40af" },
  { id: "gray", label: "Серый", bg: "#f1f5f9", text: "#475569" },
] as const;

export type GradientColorId = (typeof GRADIENT_PALETTE)[number]["id"];

export type MetricGradientStop = {
  /** Upper bound (inclusive). Null on the last stop = everything above. */
  upTo: number | null;
  colorId: GradientColorId;
};

export type MetricColorSettings = {
  enabled: boolean;
  /** 2–5 stops; last stop should have upTo = null. */
  stops: MetricGradientStop[];
};

export type MetricColorSettingsMap = Record<string, MetricColorSettings>;

export const MIN_GRADIENT_STOPS = 2;
export const MAX_GRADIENT_STOPS = 5;

export function defaultMetricColorSettings(): MetricColorSettings {
  return {
    enabled: false,
    stops: [
      { upTo: 50, colorId: "red" },
      { upTo: null, colorId: "green" },
    ],
  };
}

export function paletteEntry(colorId: GradientColorId) {
  return GRADIENT_PALETTE.find((item) => item.id === colorId) ?? GRADIENT_PALETTE[5];
}
