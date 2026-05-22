# План реализации

## Этап 1 — каркас

- Next.js проект.
- Tailwind.
- Supabase env.
- AppShell.
- Sidebar.
- Раздел Продажи.
- Табы отчетов.

## Этап 2 — фильтры

- DateRangePicker.
- Логика default period + comparison period.
- DepartmentTreeFilter.
- Section filter state.

## Этап 3 — report runtime

- `/api/reports/run`.
- `by-managers`.
- `by-product-groups`.
- current/comparison merge.
- totals.

## Этап 4 — таблица

- ReportTable.
- Sticky header/column.
- Сортировка.
- Форматирование.
- Группировка Нет/Отдел/Итого.

## Этап 5 — метрики

- Загрузка `sa.metrics`.
- MetricPickerModal.
- Сохранение выбранных метрик.
- Наборы показателей.

## Этап 6 — drill down

- DrillDownPanel.
- `/api/reports/drilldown`.
- Менеджер → товарные группы → сделки.
- Товарная группа → менеджеры → сделки.

## Этап 7 — полировка

- Empty states.
- Skeleton states.
- Ошибки Supabase.
- Проверка адаптива.
- Сохранение ширин/сортировки.

## Что НЕ делать в v1

- Универсальный конструктор датасетов.
- Универсальный chart builder.
- Сложные permissions.
- AI-слой.
- Публичные dashboards.
- Drag-and-drop dashboard grid.
- Автоматический импорт Excel.
