# Смекалочная — v1

Внутреннее BI-приложение для анализа продаж, основанное на Next.js (App Router).
Раздел «Продажи» строит отчёты `По менеджерам` и `По товарным группам` с возможностью drill down до сделок.

## Стек

- **Next.js 16** (App Router, без Turbopack)
- **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first конфиг через `@theme inline` в `app/globals.css`)
- **ESLint** (`next/core-web-vitals` + `next/typescript` + `prettier`)
- **Prettier**

## Скрипты

| Команда             | Описание                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Запуск dev-сервера на http://localhost:3000 |
| `npm run build`     | Production-сборка                          |
| `npm run start`     | Запуск собранного приложения               |
| `npm run lint`      | Проверка ESLint                            |
| `npm run typecheck` | Проверка типов (`tsc --noEmit`)            |
| `npm run format`    | Форматирование Prettier                    |

## Структура проекта

Используется **top-level App Router без `src/`**.

```
app/                  Маршруты и layout (App Router)
  layout.tsx          Корневой layout с ThemeProvider
  page.tsx            Заглушка (тоггл темы + палитра)
  globals.css         CSS-переменные дизайн-токенов и Tailwind theme
components/           Переиспользуемые UI-компоненты
  ui/ThemeToggle.tsx  Переключатель темы
features/             Доменные модули (sales, reports, …)
lib/                  Утилиты, клиенты, темизация
  theme/
    tokens.ts             Зеркало имён CSS-переменных
    inlineThemeScript.ts  Pre-hydration скрипт против FOUC
    ThemeProvider.tsx     React Context + localStorage persistence
repositories/         Адаптеры доступа к данным (Supabase / localStorage)
ai_docs/              Внутренняя документация (read-only для агентов)
database/             SQL и миграции
design/               Дизайн-документация и токены
```

## Темизация

- Все цвета приложения берутся **только** из CSS-переменных-токенов.
  Полный список — в `design/design-system-light-dark-theme.md`.
- В `app/globals.css` определены два набора:
  - `:root` — Light theme (по умолчанию).
  - `[data-theme="dark"]` — Dark theme (overrides).
- Токены экспортируются как Tailwind-утилиты через `@theme inline`,
  что даёт классы вида `bg-bg-primary`, `text-text-primary`,
  `border-border-primary`, `bg-accent-primary`, `bg-success`,
  `bg-table-header-bg`, `bg-scrollbar-thumb` и т. д.
- Активная тема выставляется атрибутом `data-theme` на `<html>`.

### Переключение темы

- Компонент `<ThemeToggle />` (см. `components/ui/ThemeToggle.tsx`)
  переключает значения `light` ↔ `dark`.
- Выбор сохраняется в `localStorage` под ключом **`bi.theme`**.
- В `<head>` вшит синхронный `inline-script` (см. `lib/theme/inlineThemeScript.ts`),
  который читает `bi.theme` до гидратации React и устанавливает `data-theme`
  на `<html>` — это устраняет FOUC при перезагрузке страницы.
- Светлая тема используется по умолчанию, если в `localStorage` ничего нет.

### Скроллбар

Глобальные стили скроллбара (WebKit + Firefox) сделаны на токенах
`scrollbar-track`, `scrollbar-thumb`, `scrollbar-thumb-hover`,
`scrollbar-thumb-active`, `scrollbar-corner` и автоматически меняются
при переключении темы.

## Локализация

UI на русском (`<html lang="ru">`). Допустимы англоязычные термины:
`drill down`, `dashboard`, `API`, `Supabase`, `report`, `metric`.

## Переменные окружения

Список переменных — в `.env.example` (добавится в задаче BI-002).
Реальные значения хранятся в `.env.local` (не коммитим).
