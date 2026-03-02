# Work Order Schedule Timeline

This project is a frontend technical exercise that implements a work order scheduling timeline for a manufacturing-style ERP system.

The goal is to visualize work orders across multiple work centers over time, allow basic CRUD operations, and enforce scheduling constraints such as non-overlapping work orders.

---

## Tech Stack

- Angular 17 (standalone components)
- TypeScript (strict mode)
- SCSS
- ng-select (status dropdown)
- @ng-bootstrap/ng-bootstrap (date picker)

---

## Features Implemented

- Fixed left column for work centers with a horizontally scrollable timeline grid
- Day / Week / Month timeline zoom levels
- Visual work order bars with status indicators
- Click-to-create work orders from the timeline
- Edit and delete actions via a contextual menu
- Validation to prevent overlapping work orders on the same work center
- Current day indicator and hover states for improved usability

---

## Project Structure

The app is organized around a central timeline component, with layout, timeline math, and form logic kept separate to make the behavior easier to reason about and extend.

Standalone Angular components are used throughout to keep the setup lightweight and explicit.

---

## Running the Project Locally

```bash
npm install
ng serve
