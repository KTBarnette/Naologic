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
