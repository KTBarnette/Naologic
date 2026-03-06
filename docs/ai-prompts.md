# AI Prompt Log

This file tracks major AI-assisted prompts and decisions used to build and finish the Work Order Schedule Timeline test.

## Phase 1 – Layout Skeleton (Codex)
**Purpose:** Build the base shell before adding timeline math.

- Prompt summary:
  > Build standalone Angular structure for fixed left work-center column + horizontally scrollable timeline grid. Exclude business logic/date math.
- Outcome:
  - Base two-panel layout (fixed left labels + scrollable right grid)
  - Aligned header and row scaffolding ready for feature work

## Phase 2 – Timeline Axis + Today Indicator (AI-assisted)
**Purpose:** Move from static layout to date-aware timeline rendering.

- Prompt summary:
  > Add date columns and a current-day indicator while preserving layout structure.
- Outcome:
  - Date-based columns and indicator rendering
  - Baseline utilities for date-to-pixel positioning

## Phase 3 – Typed Data + Work Order Bars (AI-assisted)
**Purpose:** Introduce the required data contracts and bar rendering.

- Prompt summary:
  > Add strict document types, sample manufacturing data, and bar positioning from start/end dates.
- Outcome:
  - `docId/docType/data` model adopted
  - Sample work centers/work orders rendered as status-tagged bars

## Phase 4 – SCSS Structure Pass (Codex)
**Purpose:** Stabilize layout rhythm, spacing, and grid behavior.

- Prompt summary:
  > Normalize row/header/column sizing and grid line behavior.
- Outcome:
  - Consistent sizing tokens and row alignment
  - Improved visual stability across timeline sections

## Phase 5 – Timescale Refactor (Codex)
**Purpose:** Support multiple zoom levels without duplicated rendering logic.

- Prompt summary:
  > Generalize visible timeline columns and support hour/day/week/month modes from shared math.
- Outcome:
  - `visibleColumns` abstraction
  - Reusable scale-aware positioning and column generation

## Phase 6 – Stress Mode + Render Optimization (Codex)
**Purpose:** Confirm performance and scalability characteristics.

- Prompt summary:
  > Add synthetic stress data and filter/group work orders to reduce unnecessary render work.
- Outcome:
  - `?stress` mode (50 work centers / 10,000 work orders)
  - Grouped data and visible-range filtering for better runtime behavior

## Phase 7 – Create/Edit Panel + Validation (AI-assisted)
**Purpose:** Implement primary CRUD flow and form constraints.

- Prompt summary:
  > Add click-to-create side panel with `ng-select`, `ngb-datepicker`, and overlap/date validation.
- Outcome:
  - Create/Edit panel with prefilled dates
  - Required-field/date-range/overlap validation
  - Cancel/click-outside/Escape interactions

## Phase 8 – Kebab Actions + Overlay Menu (AI-assisted)
**Purpose:** Add in-row action controls and robust menu behavior.

- Prompt summary:
  > Add per-bar kebab menu with Edit/Delete, outside-click handling, and safe event propagation.
- Outcome:
  - Floating actions menu with Edit/Delete
  - Reliable close behavior (outside click/Escape)
  - Correct overlay layering above timeline content

### Debugging Note

An edit-flow freeze surfaced during development due to repeated expensive validation work during change detection. Validation logic was refactored to reduce repeated scans, restoring responsive interaction behavior.

## Phase 9 – Requirement Alignment Pass (Codex)
**Purpose:** Align implementation and docs to technical test expectations.

- Prompt summary:
  > Validate required schema/features, strengthen README coverage, and keep implementation demo-ready.
- Outcome:
  - Required document schema and sample coverage validated
  - Timeline interactions, overlap rules, and panel behavior aligned
  - README and supporting notes improved for evaluator clarity

## Phase 10 – Pixel-Perfect Visual QA + Hotfixes (User + Codex)
**Purpose:** Final visual matching against Sketch through iterative inspection and CSS hotfixes.

- Prompt summary:
  > Compare live UI against inspected Sketch measurements and apply exact dimension/color/spacing/typography adjustments.
- Outcome:
  - Work-center header aligned flush with timeline header
  - Hover affordance rebuilt to spec:
    - top label pill (`Rectangle 7`) sizing, fill, shadow, and CircularStd-Book text tuning
    - lower hover slot dimensions/border/fill tuning
  - Timeline row and bar heights updated to target values
  - Kebab button and Edit/Delete floating menu resized to inspected dimensions
  - Month scrollbar behavior restored to left-justified
  - Hour menu option/functionality restored after regression

## Phase Omega – Final Submission Completion (User + Codex)
**Purpose:** Close the loop on submission readiness and delivery quality.

- Prompt summary:
  > Perform final requirement sweep, resolve conflicting default-view guidance, verify clean-run commands, and finalize handoff docs.
- Outcome:
  - Resolved default-timescale interpretation for submission (Month default per walkthrough expectation)
  - Preserved Day/Week/Month/Hour support and corrected Save/Create panel labeling behavior
  - Timeline now anchors to current date context while sample data was shifted into a visible current window for demo reliability
  - README expanded with clean-run checklist + Loom section placeholder
  - Clean-run validation completed (`npm ci`, `npm run build`, `npm start`), including build-budget adjustment to prevent production build failure
  - Project prepared for final Loom recording and public repo submission
