## Phase 1 – Layout Skeleton (Codex)
**Purpose:** Generate a layout-only Angular timeline skeleton.

- Prompt summary:
  > Build standalone Angular structure for fixed left work-center column + horizontally scrollable timeline grid. Exclude business logic/date math.
- Outcome:
  - Base layout with aligned header/rows
  - Clean starting point for timeline logic

## Phase 2 – Day Timeline & Today Indicator (AI-assisted)
**Purpose:** Convert layout to a real date-based day timeline.

- Prompt summary:
  > Add real day columns around today and a vertical today indicator while keeping layout structure.
- Outcome:
  - Day-based columns centered on today
  - Today indicator aligned to timeline dates

## Phase 3 – Static Work Orders (AI-assisted)
**Purpose:** Render typed sample work orders as non-interactive bars.

- Prompt summary:
  > Add strict document types, sample manufacturing data, and day-based bar positioning.
- Outcome:
  - Added typed docs + sample data
  - Static work-order bars with status badges

## Phase 4 – SCSS Structural Pass (Codex)
**Purpose:** Normalize sizing/grid constants and alignment.

- Prompt summary:
  > Apply consistent row/header/column sizing and grid line behavior.
- Outcome:
  - Unified layout tokens and grid dimensions
  - Stable two-panel alignment

## Phase 5 – Day/Week/Month Refactor (Codex)
**Purpose:** Add timescale switching with shared positioning math.

- Prompt summary:
  > Generalize visible timeline columns and support day/week/month views.
- Outcome:
  - `visibleColumns` abstraction
  - Zoom switching without duplicating rendering logic

## Phase 6 – Stress Mode + Rendering Optimization (Codex)
**Purpose:** Validate scalability and reduce unnecessary render work.

- Prompt summary:
  > Add synthetic stress data and filter work orders to visible range.
- Outcome:
  - `?stress` mode (50 centers / 10,000 orders)
  - Grouped/filtered rendering for performance

## Phase 7 – Create Panel + Hover Affordance (AI-assisted)
**Purpose:** Implement click-to-create workflow and panel form.

- Prompt summary:
  > Add “Click to add dates” row affordance, right-side Work Order Details panel, `ng-select` status, `ngb-datepicker` dates, and overlap/date validation.
- Outcome:
  - Click empty row opens create panel with prefilled start date and end date = start + 7
  - Scrim/Esc close behavior
  - Validation blocks invalid saves

## Phase 8 – Actions Menu + Floating Overlay (AI-assisted)
**Purpose:** Add Edit/Delete actions on each work-order bar.

- Prompt summary:
  > Add kebab actions, outside-click/Esc handling, propagation guards, and ensure menu is not hidden by timeline stacking.
- Outcome:
  - Kebab actions per bar with Edit/Delete
  - Single floating overlay menu positioned from kebab coordinates
  - Menu closes on outside click or Esc and stays above bars/grid

### Debugging Note

During development, clicking "Edit" caused the UI to freeze due to expensive validation logic executing repeatedly during Angular change detection. Instrumentation was added to isolate the issue, and the validation logic was refactored to avoid repeated O(n) scans of work orders, restoring responsiveness even in stress mode.

## Phase 9 – Technical Test Alignment (Codex)
**Purpose:** Align implementation to the frontend technical test rubric.

- Prompt summary:
  > Update data contracts to `docId/docType/data`, enforce Day default timescale, restore dynamic today-centered columns, and ensure Create/Edit panel button text matches requirements.
- Outcome:
  - Data model now matches required document shape
  - Sample data expanded to 5+ work centers and 8+ work orders with all statuses
  - Create/Edit flows and overlap validation retained with updated schema
  - Added Circular Std font include and updated README requirement coverage
