# Changelog

All notable changes to kinetik are documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Keyboard sensor** — Space/Enter picks up and drops, arrow keys move, Escape
  cancels. Works for both `useSortable` and `useDraggable`. Screen-reader users
  now have first-class access to drag-and-drop.
- **`aria-live` announcements** — `__kinetik_live` region is auto-created on
  first keyboard event. Announces pickup, movement direction, and drop position.
- **`tabIndex` and `role`** attributes on draggables so they're keyboard-focusable.
- **Generic type parameters** on `useSortableContainer<T>`, `useSortable<T>`, and
  `useDraggable<T>` for compile-time id safety.
- **Dev-mode warnings** for duplicate id registration, missing container, and
  `useEngine()` outside `<DndContext>`.
- **StrictMode-safe** — verified by `src/react/reliability.test.tsx` (8 tests).
- **React 19 + concurrent mode** — verified compatible by `reliability.test.tsx`.
- **SSR safety** — `__DEV__` constant is stripped from production builds.

### Performance
- Unit test runtime cut from 12.7s → 3.4s via `vitest --isolate=false` with
  global `afterEach` cleanup.

## [0.0.1] — 2026-07-06

### Added
- Initial release of the core engine and React adapter.
- Velocity-based predictive collision.
- Inertial "throw" release above `throwVelocityThreshold` (default 700 px/s).
- Cooperative "lean" neighbor events.
- View Transitions API integration (`useViewTransition`).
- Smart first-frame pickup (15% initial delta on activation).
- Predictive auto-scroll based on velocity × `lookAheadMs`.
- Modifiers: `restrictToHorizontalAxis`, `restrictToVerticalAxis`,
  `restrictToWindowEdges`, `restrictToParentElement`, `snapToGrid`.
- Adapters: `useFileDrop`, `useTextDraggable` (native HTML5 drag events).
- Multi-select drag data model (`useMultiDrag`).
- Semantic drop actions (`useActionDroppable`).
- Closest-center cross-container strategy (`closestCenterStrategy`).

[Unreleased]: https://github.com/kinetik/kinetik/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/kinetik/kinetik/releases/tag/v0.0.1

## Performance — Unreleased

### Changed
- **Scratch buffers in `updateDrag`** — engine now reuses module-private
  Rect/Translate buffers instead of allocating fresh objects every frame.
  During a 1000-frame drag, GC pressure drops to near zero.
- **`Array.from(containers.values())` cached** — rebuilt only when the
  container set changes, not every frame.
- **Inline `projectRect`** — math is now in the hot path, saving a function
  call per frame.
- **`will-change: transform` during drag** — promotes the active element to
  its own compositor layer, eliminating main-thread repaint during drag.
- **Skip autoscroll when velocity ≈ 0** — saves a per-container iteration
  on the common stationary case.
- **Skip modifier loop when no modifiers are registered** — the common case
  in the demo, fastest path.

### Added
- `bench/` directory with three benchmarks: `bench.ts`, `micro-frame.bench.ts`,
  `allocation.bench.ts`. Run with `npm run bench`, `npm run bench:frame`,
  `npm run bench:alloc`.
- `bench/RESULTS.md` with measured numbers (single-tick cost is 4-8 µs at
  50 items, well under the 16.6ms 60fps budget).
- `e2e/perf-frame-budget.spec.ts` — measures real chromium frame time
  during a drag and asserts p95 stays under 60ms.
