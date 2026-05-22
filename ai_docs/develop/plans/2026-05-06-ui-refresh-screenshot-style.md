# Plan: UI refresh (screenshot-style light gradients)

**Created:** 2026-05-06  
**Orchestration:** orch-2026-05-06-16-05-ui-refresh  
**Status:** 🟢 Ready  
**Goal:** Redesign the app UI to match the provided screenshot style: soft light UI, subtle gradients, rounded corners, modern cards, pill buttons, and consistent spacing—while keeping a token-driven Tailwind v4 approach and keeping dark mode reasonable.

## What “match screenshot style” means (visual targets)

- **Overall canvas**: light, airy background with a subtle cool gradient and soft noise-free look; content sits on elevated, rounded “panels”.
- **Surfaces**: cards/panels are rounded (≈12–16px), with soft shadow and subtle border (not heavy outlines).
- **Controls**: buttons are pill/rounded, with gentle gradients for primary action; icon buttons are circular/rounded with hover states; inputs are lightly elevated with clear focus ring.
- **Tables**: table sits inside a rounded container with a header strip; rows have gentle separators and hover; the container has shadow and border like a card.
- **Top chrome** (Sales section): header/filter tabs/toolbar feel like nested panels: stacked rounded rows with consistent spacing.
- **Branding**: “Смекалочная” as app name; sidebar header includes logo + brand label; ensure logo asset exists in `public/`.

## Constraints / approach

- **Token-driven**: implement new look via CSS variables in `app/globals.css` and consume them via Tailwind utilities; avoid hardcoded hex values scattered through components.
- **Minimal refactor**: focus on styling + small layout tweaks (padding/radius/shadow) in existing components.
- **Dark mode**: keep existing dark tokens, add gradient/surface tokens in dark variants so it remains usable (even if screenshot is light).

## Key files/components likely to change

- **Tokens / base**: `app/globals.css`
- **Root chrome**: `components/shell/AppShell.tsx`, `app/layout.tsx`
- **Sidebar**: `components/shell/Sidebar.tsx`, `components/shell/SidebarItem.tsx`
- **Sales top chrome**: `components/shell/SectionHeader.tsx`, `components/filters/FilterBar.tsx`, `components/shell/ReportTabs.tsx`
- **Report UI**: `components/reports/ReportToolbar.tsx`, `components/reports/ReportTable.tsx` (+ possibly header/row/totals for separators/hover)
- **Modals**: `components/reports/MetricPickerModal.tsx`, `components/reports/DrillDownPanel.tsx` (surface/shadow/radius consistency)
- **Brand asset**: `public/smekalochnaya_logo.png` (currently referenced by Sidebar but not present in `public/`)

## Tasks (≤10)

- [ ] **UI-001: Add gradient + radius + shadow tokens** (High, Moderate) ⏳ Pending  
  - **Depends on**: none  
  - **Files**: `app/globals.css`  
  - **Plan**:
    - Add semantic tokens for:
      - App background gradient (e.g. `--bg-app-gradient-start/end`)
      - Panel/card gradient (very subtle) and “frosted” highlight for headers
      - Radius scale (e.g. `--radius-sm/md/lg/xl`), map to Tailwind-friendly usage (either via arbitrary values or theme variables)
      - A “soft” shadow for cards (lighter than existing `--shadow-md`)
    - Add matching `[data-theme="dark"]` overrides to keep contrast and avoid banding.
  - **Acceptance criteria**:
    - Tokens exist in both light and dark themes.
    - Components can switch to the new look by changing utility classes (no new hardcoded colors in components).

- [ ] **UI-002: Implement app background gradient surface** (High, Simple) ⏳ Pending  
  - **Depends on**: UI-001  
  - **Files**: `app/layout.tsx` (body classes) and/or `app/globals.css` (`body` background)  
  - **Plan**:
    - Set the main page background to a subtle gradient (as in screenshot).
    - Keep scrollbars/focus styles consistent with new surfaces.
  - **Acceptance criteria**:
    - App background reads as a gentle gradient behind content (light theme).
    - Dark theme uses a darker gradient (or solid) with no readability regressions.

- [ ] **UI-003: Restyle AppShell and main content container** (High, Moderate) ⏳ Pending  
  - **Depends on**: UI-002  
  - **Files**: `components/shell/AppShell.tsx`, `app/sales/layout.tsx`  
  - **Plan**:
    - Introduce a “content panel” pattern: main content area uses padding and an inner rounded container to mimic screenshot’s inset panels.
    - Ensure consistent spacing between stacked chrome elements (header → filters → tabs → content).
  - **Acceptance criteria**:
    - The main column feels like a layered UI (background → panel → inner cards), not flat blocks.

- [ ] **UI-004: Restyle Sidebar header + logo + nav items** (High, Moderate) ⏳ Pending  
  - **Depends on**: UI-003  
  - **Files**: `components/shell/Sidebar.tsx`, `components/shell/SidebarItem.tsx`  
  - **Plan**:
    - Sidebar gets a soft card look (rounded edges against background, subtle shadow/border).
    - Header row matches “pill + icon button” feel (rounded header container).
    - Nav items: active state becomes a soft filled pill; hover uses a faint tint.
    - Ensure the logo treatment matches screenshot (rounded container, no heavy borders).
  - **Acceptance criteria**:
    - Sidebar looks like a modern rounded rail with soft separators.
    - Active item is clearly visible but not harsh.

- [ ] **UI-005: Restyle SectionHeader, FilterBar, ReportTabs** (High, Moderate) ⏳ Pending  
  - **Depends on**: UI-003  
  - **Files**: `components/shell/SectionHeader.tsx`, `components/filters/FilterBar.tsx`, `components/shell/ReportTabs.tsx`  
  - **Plan**:
    - Convert these into stacked “panel rows”: rounded, lightly elevated strips with consistent spacing.
    - Tabs become more “pill” with subtle fill for active state.
  - **Acceptance criteria**:
    - The top-of-page chrome visually matches screenshot’s layered, rounded strips.

- [ ] **UI-006: Restyle ReportToolbar buttons to pill style** (High, Moderate) ⏳ Pending  
  - **Depends on**: UI-005  
  - **Files**: `components/reports/ReportToolbar.tsx`  
  - **Plan**:
    - Primary/secondary button styling: rounded (pill), subtle gradient for primary, soft hover, and consistent icon sizing.
    - Icon-only refresh becomes a circular/rounded icon button.
  - **Acceptance criteria**:
    - Buttons look modern and consistent with screenshot (no “flat bordered rectangles” feel).

- [ ] **UI-007: Restyle ReportTable container and table chrome** (High, Moderate) ⏳ Pending  
  - **Depends on**: UI-006  
  - **Files**: `components/reports/ReportTable.tsx`, likely `components/reports/ReportTableHeader.tsx`, `components/reports/ReportTableRow.tsx`, `components/reports/ReportTableTotals.tsx`  
  - **Plan**:
    - Table wrapper becomes a “card”: larger radius, softer shadow, header background strip, and improved padding.
    - Row hover and separators tuned to be subtle (screenshot-like).
  - **Acceptance criteria**:
    - Table area reads as a single rounded panel with a soft header and clean rows.

- [ ] **UI-008: Align modal/popover surfaces with new theme** (Medium, Moderate) ⏳ Pending  
  - **Depends on**: UI-001  
  - **Files**: `components/reports/MetricPickerModal.tsx`, `components/reports/DrillDownPanel.tsx`, any other Radix surfaces  
  - **Plan**:
    - Ensure modals/panels use the new radius and softer shadows.
    - Overlay feels consistent with new light UI (no overly dark overlay in light mode).
  - **Acceptance criteria**:
    - Modals feel like part of the same design language (radius/shadow/borders consistent).

- [ ] **UI-009: Add/verify brand assets and metadata** (Medium, Simple) ⏳ Pending  
  - **Depends on**: none  
  - **Files**: `public/smekalochnaya_logo.png`, `app/layout.tsx`  
  - **Plan**:
    - Add the logo asset to `public/` (currently referenced in `Sidebar.tsx`).
    - Confirm metadata title/description uses “Смекалочная” (already set) and ensure sidebar label is correct (already present).
  - **Acceptance criteria**:
    - Logo loads in sidebar without 404.
    - Brand text reads “Смекалочная” everywhere it should.

## Verification checklist (manual visual)

- Light theme:
  - Background gradient visible but subtle.
  - Sidebar + top chrome + table read as layered rounded panels with soft shadows.
  - Buttons are pill-like and feel modern (hover/focus states).
- Dark theme:
  - Text contrast remains readable.
  - Panels still distinguishable; gradients do not reduce clarity.
- Responsiveness:
  - Sidebar collapsed/expanded still looks coherent.
  - Top chrome doesn’t overflow or look cramped.

