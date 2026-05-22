"use client";

import { useEffect, useMemo, useState } from "react";

import type { MetricCatalogRow } from "@/features/reports/useMetricsCatalog";
import { formatCellValue } from "@/lib/format/cell";

import {
  GRADIENT_PALETTE,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  defaultMetricColorSettings,
  paletteEntry,
  type GradientColorId,
  type MetricColorSettings,
} from "@/features/reports/metricColorSettings/types";
import {
  resizeGradientStops,
  resolveMetricValueStyle,
} from "@/features/reports/metricColorSettings/gradient";
import {
  formatThresholdForInput,
  parseThresholdInput,
  thresholdFieldLabel,
  thresholdInputMode,
} from "@/features/reports/metricColorSettings/thresholdInput";
import { useMetricColorSettings } from "@/features/settings/hooks/useMetricColorSettings";

type MetricColorSettingsPanelProps = {
  metric: MetricCatalogRow;
  onClose: () => void;
};

export function MetricColorSettingsPanel({
  metric,
  onClose,
}: MetricColorSettingsPanelProps) {
  const { getSettingsForMetric, setSettings, resetSettings } =
    useMetricColorSettings();

  const metricId = metric.id;
  const metricLabel = metric.name_ru;
  const dataType = metric.data_type;
  const decimalPlaces = metric.decimal_places ?? 0;

  const saved = getSettingsForMetric(metricId);
  const [draft, setDraft] = useState<MetricColorSettings>(saved);
  const [thresholdTexts, setThresholdTexts] = useState<string[]>([]);

  useEffect(() => {
    const next = getSettingsForMetric(metricId);
    setDraft(next);
    setThresholdTexts(
      next.stops.map((stop, index) =>
        index === next.stops.length - 1
          ? ""
          : formatThresholdForInput(stop.upTo, dataType, decimalPlaces),
      ),
    );
  }, [metricId, dataType, decimalPlaces, getSettingsForMetric]);

  const previewStyle = useMemo(() => {
    const sampleValue = draft.stops[0]?.upTo ?? (dataType === "percent" ? 10 : 100);
    return resolveMetricValueStyle(sampleValue, draft);
  }, [dataType, draft]);

  const previewLabel = formatCellValue(
    draft.stops[0]?.upTo ?? (dataType === "percent" ? 10 : 100),
    dataType,
    decimalPlaces,
  );

  const handleStopCountChange = (count: number) => {
    setDraft((prev) => {
      const stops = resizeGradientStops(prev.stops, count);
      setThresholdTexts(
        stops.map((stop, index) =>
          index === stops.length - 1
            ? ""
            : formatThresholdForInput(stop.upTo, dataType, decimalPlaces),
        ),
      );
      return { ...prev, stops };
    });
  };

  const handleThresholdChange = (index: number, value: string) => {
    setThresholdTexts((prev) =>
      prev.map((text, textIndex) => (textIndex === index ? value : text)),
    );
    const parsed = parseThresholdInput(value, dataType);
    if (parsed === null && value.trim() !== "") return;
    setDraft((prev) => ({
      ...prev,
      stops: prev.stops.map((stop, stopIndex) =>
        stopIndex === index
          ? {
              ...stop,
              upTo: parsed,
            }
          : stop,
      ),
    }));
  };

  const handleColorChange = (index: number, colorId: GradientColorId) => {
    setDraft((prev) => ({
      ...prev,
      stops: prev.stops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, colorId } : stop,
      ),
    }));
  };

  const handleApply = () => {
    setSettings(metricId, draft);
    onClose();
  };

  const handleReset = () => {
    resetSettings(metricId);
    setDraft(defaultMetricColorSettings());
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-bg-overlay/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-[min(320px,calc(100%-2rem))] rounded-lg border border-border-primary bg-popover-bg p-4 shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-color-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <h4
            id="metric-color-settings-title"
            className="text-sm font-medium text-text-primary"
          >
            Цветовой градиент
          </h4>
          <p className="mt-1 text-xs text-text-muted">{metricLabel}</p>
        </div>

        <label className="mb-3 flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, enabled: event.target.checked }))
            }
            className="rounded border-border-primary"
          />
          Подсвечивать значения
        </label>

        <div className="mb-3">
          <span className="mb-1 block text-xs text-text-muted">
            Количество порогов
          </span>
          <div className="flex gap-1">
            {Array.from(
              { length: MAX_GRADIENT_STOPS - MIN_GRADIENT_STOPS + 1 },
              (_, offset) => MIN_GRADIENT_STOPS + offset,
            ).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleStopCountChange(count)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  draft.stops.length === count
                    ? "bg-accent-primary text-text-on-accent"
                    : "border border-border-primary text-text-secondary hover:bg-bg-card-hover"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <ul className="mb-3 flex max-h-[240px] flex-col gap-2 overflow-y-auto">
          {draft.stops.map((stop, index) => {
            const isLast = index === draft.stops.length - 1;
            return (
              <li
                key={`${metricId}-stop-${index}`}
                className="rounded-md border border-border-primary bg-bg-card p-2"
              >
                <div className="mb-2 text-xs font-medium text-text-secondary">
                  {isLast
                    ? "Выше последнего порога"
                    : thresholdFieldLabel(dataType)}
                </div>
                {!isLast ? (
                  <input
                    type="text"
                    inputMode={thresholdInputMode(dataType)}
                    value={thresholdTexts[index] ?? ""}
                    onChange={(event) =>
                      handleThresholdChange(index, event.target.value)
                    }
                    placeholder={
                      dataType === "percent"
                        ? "12,5"
                        : dataType === "money"
                          ? "1 000 000"
                          : "100"
                    }
                    className="mb-2 w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent-primary"
                  />
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {GRADIENT_PALETTE.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={color.label}
                      title={color.label}
                      onClick={() => handleColorChange(index, color.id)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-105 ${
                        stop.colorId === color.id
                          ? "border-accent-primary"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color.bg }}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className="mb-3 rounded-md px-3 py-2 text-right text-sm tabular-nums"
          style={
            previewStyle ?? {
              backgroundColor: paletteEntry("gray").bg,
              color: paletteEntry("gray").text,
            }
          }
        >
          Пример: {previewLabel}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            Сбросить
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-accent-primary px-3 py-1.5 text-sm text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
