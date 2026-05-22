"use client";

/**
 * Right column of the MetricPickerModal: shows the currently-selected
 * metrics in their final order with a drag handle (powered by
 * `@dnd-kit/sortable`) and a remove button.
 */
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, X } from "lucide-react";

import { MetricColorSettingsPanel } from "./MetricColorSettingsPanel";

import type { MetricCatalogRow } from "@/features/reports/useMetricsCatalog";

type MetricPickerPreviewProps = {
  selectedIds: string[];
  metricsById: Map<string, MetricCatalogRow>;
  onReorder: (next: string[]) => void;
  onRemove: (metricId: string) => void;
  onOpenColorSettings: (metricId: string) => void;
};

export function MetricPickerPreview({
  selectedIds,
  metricsById,
  onReorder,
  onRemove,
  onOpenColorSettings,
}: MetricPickerPreviewProps) {
  // PointerSensor with a small distance avoids clashing with the
  // remove button click. 4px is enough to disambiguate intent.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedIds.indexOf(String(active.id));
    const newIndex = selectedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(selectedIds, oldIndex, newIndex));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-primary">Выбрано</span>
        <span className="text-xs text-text-muted">
          {selectedIds.length} из доступных
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-primary">
        {selectedIds.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-text-muted">
            Выберите метрики из списка слева
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-border-primary">
                {selectedIds.map((id) => (
                  <SortableMetricRow
                    key={id}
                    id={id}
                    label={metricsById.get(id)?.name_ru ?? id}
                    sublabel={metricsById.get(id)?.category ?? null}
                    onRemove={() => onRemove(id)}
                    onOpenColorSettings={() => onOpenColorSettings(id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

type SortableMetricRowProps = {
  id: string;
  label: string;
  sublabel: string | null;
  onRemove: () => void;
  onOpenColorSettings: () => void;
};

function SortableMetricRow({
  id,
  label,
  sublabel,
  onRemove,
  onOpenColorSettings,
}: SortableMetricRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-bg-card px-2 py-2"
    >
      <button
        type="button"
        aria-label="Перетащить"
        className="cursor-grab rounded p-1 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-secondary active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text-primary">{label}</span>
        {sublabel ? (
          <span className="truncate text-xs text-text-muted">{sublabel}</span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`Настройки цвета для ${label}`}
        onClick={onOpenColorSettings}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-secondary"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Settings2 className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Убрать метрику"
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-danger"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
