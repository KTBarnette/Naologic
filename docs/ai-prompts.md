## Phase 1 – Layout Skeleton (Codex)
**Purpose:** Generate a layout-only Angular 17+ skeleton for the timeline UI.

- Prompt summary:
  > Asked Codex to scaffold standalone components + SCSS for a fixed left panel and horizontally scrollable right grid. Explicitly excluded business logic, date math, ERP logic, and libraries.
- Outcome:
  - Established timeline layout structure (fixed left, scrollable right, sticky header, aligned rows)
  - Kept implementation minimal and interview-safe

## Phase 2 – Day Timeline & Today Indicator (AI-assisted)
**Purpose:** Extend the timeline layout to a real Day-based view centered on today.

- Prompt summary:
  > Asked AI to help refactor the timeline grid from a fixed-column layout to a dynamic Day-based layout with date-driven columns and a vertical “today” indicator. Explicitly excluded work orders, create/edit flows, overlap detection, zoom switching, and ERP/business logic.

- Outcome:
  - Implemented a Day-based timeline grid (±2 weeks) using real calendar dates
  - Added a current-day indicator aligned to the correct date column
  - Preserved fixed left panel and horizontally scrollable timeline grid
  - Maintained a clean separation between layout/date visualization and business logic

## Phase 3 – Static Work Orders on Day Timeline (AI-assisted)

**Purpose:** Render realistic, non-interactive work order bars on a Day-based timeline using sample data.

- Prompt summary:
  > Asked AI to assist with defining strict TypeScript document models, generating hardcoded sample data, and positioning static work-order bars on a day-based timeline using SCSS-only styling. Explicitly excluded create/edit flows, services, persistence, and overlap logic.

- Outcome:
  - Introduced strongly typed document interfaces (WorkCenterDocument, WorkOrderDocument, WorkOrderStatus)
  - Added hardcoded sample data:
    - 5 work centers
    - 9 work orders
    - All required status types represented
    - Multiple non-overlapping orders on the same work center
  - Implemented day-based bar positioning using helper functions for left offset and width
  - Rendered work order bars above the grid with status pills and hover affordances
  - Preserved separation of concerns and kept logic minimal and readable

## Phase 4 — Codex SCSS pass

Codex reported Phase 4 implemented via SCSS only:
- Added CSS variables: left panel 380px, row 38px, header 32px, grid line rgba(230,235,240,1), 1px
- Enforced 2-column grid layout: 380px + minmax(0,1fr)
- Applied consistent row/header sizing and grid lines
- Avoided doubled borders

Next: verify selectors match DOM and confirm computed sizes in DevTools.

## Phase 5 — Codex timeline refactor (Day / Week / Month)

Codex implemented timeline zoom support with minimal structural changes:
- Introduced `timescale` state: `'day' | 'week' | 'month'`
- Replaced `visibleDates` with generalized `visibleColumns`
- Added column builders centered on today:
  - Day view: ±14 days
  - Week view: ±8 weeks (7-day columns)
  - Month view: ±6 months (calendar month columns)
- Added `colWidthPx` getter to scale column width by zoom level (84 / 168 / 224)
- Updated work-order positioning math to use shared `utcDay → pixel` conversion
- Implemented inclusive end-date handling (`endUtcDay + 1`)
- Added minimal timescale selector using `(change)="setTimescale(($any($event.target)).value)"`
- Applied `--col-w` CSS variable to control column widths across header and grid cells

Runtime fixes applied:
- Ensured `visibleColumns` is initialized via `rebuildColumns()` in constructor
- Typed grouped orders as `Partial<Record<string, WorkOrderDocument[]>>` to allow safe template fallback
- Bound `--col-w` directly on timeline rows to guarantee CSS inheritance

Result:
- Timeline renders correctly
- Day / Week / Month switching updates column layout and bar scaling
- Today indicator and work-order bars remain correctly positioned

Next: implement Create Work Order slide-out panel triggered by clicking empty timeline cells.

## Phase 5 — Codex Timescale switching (Day/Week/Month)

Codex implemented timescale switching by introducing a generalized “column” abstraction:
- Added `Timescale = 'day' | 'week' | 'month'`
- Replaced `visibleDates` with `visibleColumns` containing labels + boundaries
- Implemented day/week/month column builders centered on today
- Updated bar positioning and today indicator to work against columns
- Updated template loops to render `visibleColumns` and added a minimal `<select>` to switch timescale
- Minor SCSS updates to support the selector and column-width variable

Next: validate week/month labels against Sketch, and ensure performance by filtering rendered work orders to only those intersecting the visible range.

## Phase 6 — Codex Stress Mode + Rendering Optimization

Codex implemented a runtime stress dataset to test scalability.

- Added deterministic data generator (`stress-documents.ts`)
- Implemented `generateWorkCenters()` and `generateWorkOrders()` with seeded RNG
- Stress mode activated via `?stress` URL parameter
- Stress configuration:
  - 50 work centers
  - 10,000 work orders
- Added visible-range filtering (`visibleWorkOrdersForCenter`) to avoid rendering offscreen bars
- Introduced cached grouping (`workOrdersByWorkCenterId`) to avoid recomputation

Next: polish create/edit panel behavior and finalize UI details.

## Phase 7 – Create/Edit Panel + Hover Affordance (Codex)

**Purpose:** Implement the interactive create/edit workflow for work orders including the slide-out panel, hover affordance, and required form controls.

- Prompt summary:
  > Asked Codex to implement the create/edit workflow within the existing timeline component: add a “Click to add dates” hover affordance on empty timeline rows, implement a right-side slide-out **Work Order Details** panel using **Reactive Forms**, replace status inputs with **ng-select**, replace date inputs with **ngb-datepicker**, preserve ISO date storage, add ESC and scrim-close behavior, and ensure overlap detection prevents invalid saves.

- Outcome:
  - Added hover affordance pill (“Click to add dates”) that follows the cursor on empty timeline rows
  - Implemented a right-side slide-out **Work Order Details** panel with scrim and ESC-to-close behavior
  - Unified **Create** and **Edit** flows using a single panel and reactive form
  - Integrated **ng-select** for status and **ngb-datepicker** for start/end date inputs
  - Added helper converters to map between ISO dates and datepicker structures
  - Defaulted new work orders to **start date from click position + end date = start + 7 days**
  - Preserved validation logic including **required fields, date range validation, and overlap detection** to block invalid saves

  ## Phase 8 — Work Order Actions Menu (AI-assisted)

**Purpose:** Add per-work-order actions (Edit/Delete) through a three-dot kebab menu on each timeline bar.

- Prompt summary:
  > Asked AI to implement a kebab (⋮) actions menu on the right side of each work-order bar with Edit and Delete options. Required minimal structural changes limited to `timeline.component.ts`, `timeline.component.html`, and `timeline.component.scss`. Explicitly required stopping event propagation so menu clicks do not trigger bar or row click handlers, supporting only one open menu at a time, and implementing close behaviors (outside click + ESC).

- Outcome:
  - Added `openActionsMenuWorkOrderId` state to track the currently open menu
  - Implemented handlers to toggle the menu, edit from the menu, and delete a work order by id
  - Reused existing edit behavior via extracted `openEditPanel(...)`
  - Added outside-click detection to close the menu
  - Added ESC key handling so the menu closes before the slide-out panel
  - Implemented kebab button (⋮) on each work-order bar with dropdown actions
  - Styled dropdown menu with rounded corners, hover states, and subtle shadow
  - Ensured event propagation is stopped so kebab clicks do not trigger bar or row interactions
  - Verified build with `CI=1 npx ng build`
  
## Phase 8 — Work Order Actions Menu (AI-assisted)

**Purpose:** Implement per-work-order actions via a three-dot kebab menu with Edit/Delete functionality while ensuring correct interaction behavior, stacking order, and compatibility with the timeline layout.

- Prompt summary:
  > Asked AI to implement a kebab (⋮) actions menu on each work-order bar with Edit and Delete options. Required minimal changes limited to `timeline.component.ts`, `timeline.component.html`, and `timeline.component.scss`. The implementation needed to support a single open menu at a time, prevent event propagation from triggering row or bar click handlers, support close behaviors (outside click + ESC), and avoid UI conflicts with the row hover affordance and timeline stacking layers.

- Outcome:
  - Added kebab button (⋮) to each work-order bar with Edit/Delete actions
  - Implemented menu state management for a single open menu instance
  - Prevented event propagation so menu interactions do not trigger bar click or row create behaviors
  - Implemented outside-click detection and ESC key handling to close the menu
  - Integrated menu actions with existing edit and delete logic
  - Adjusted hover affordance behavior so the “Click to add dates” pill hides while the actions menu is active
  - Addressed stacking and overflow issues that caused the dropdown to render beneath adjacent bars and grid elements
  - Refactored the menu implementation into a **floating overlay menu** rendered once at the timeline panel level
  - Positioned the floating menu using the kebab button’s bounding rectangle and scroll offsets
  - Ensured the menu is not clipped by timeline stacking contexts and always appears above timeline bars and grid layers
  - Styled the menu with rounded corners, subtle shadows, and hover states consistent with the design
  - Verified successful build using `CI=1 npx ng build`
