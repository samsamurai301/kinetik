/**
 * kinetik — main entry point.
 *
 *   import { DndContext, useSortable, useSortableContainer, DragOverlay } from 'kinetik'
 *
 * That's the whole library for the common case. For framework-agnostic use,
 * import from 'kinetik/core' instead.
 *
 * Subpath exports:
 *   'kinetik'          — everything (this file)
 *   'kinetik/core'     — framework-agnostic engine + collision + animator
 *   'kinetik/react'    — React adapter (DndContext + hooks)
 *   'kinetik/modifiers' — standalone modifier functions
 *   'kinetik/adapters' — native HTML5 drag adapters
 */

// React surface — the easy way in.
export {
  DndContext,
  useEngine,
  useDragState,
  type DndContextProps,
  type DragEndEvent,
} from './react/DndContext.js'
export {
  useSortable,
  useSortableContainer,
  type UseSortableOptions,
  type UseSortableReturn,
} from './react/useSortable.js'
export { useDraggable, type UseDraggableOptions, type UseDraggableReturn } from './react/useDraggable.js'
export {
  useDroppable,
  type UseDroppableOptions,
  type UseDroppableReturn,
} from './react/useDroppable.js'
export { DragOverlay, type DragOverlayProps } from './react/DragOverlay.js'

// Core surface — for advanced users / custom adapters.
export { DragEngine, type EngineOptions, type EngineEvents } from './core/engine.js'
export {
  sortableStrategy,
  rectIntersectionStrategy,
  closestCenterStrategy,
  projectRect,
  readRect,
} from './core/collision.js'
export {
  springTo,
  captureFlip,
  defaultSpring,
  bouncySpring,
  computeAutoScroll,
  type SpringConfig,
  type AnimationHandle,
  type FlipSnapshot,
} from './core/animator.js'


// View Transitions — wrap reorders in document.startViewTransition for free motion.
export { useViewTransition, viewTransitionName } from './react/useViewTransition.js'

// HTML5 adapters (file drops, text drags).
export {
  useFileDrop,
  type UseFileDropOptions,
  type FileDropHookReturn,
} from './react/useFileDrop.js'
export {
  useTextDraggable,
  type UseTextDraggableOptions,
} from './react/useTextDraggable.js'

// Power features: multi-select, semantic drop actions.
export {
  useMultiDrag,
  useMultiDragItem,
  type MultiDragState,
  type UseMultiDragOptions,
} from './react/useMultiDrag.js'
export {
  useActionDroppable,
  type UseActionDroppableOptions,
  type UseActionDroppableReturn,
  type DropActionKind,
} from './react/useActionDroppable.js'

// Keyboard sensor — auto-attached by useSortable / useDraggable but exposed
// for users who want lower-level control.
export {
  useKeyboardSensor,
  draggableCursor,
  type UseKeyboardSensorOptions,
  type UseKeyboardSensorReturn,
} from './react/useKeyboardSensor.js'

// Modifiers — opt-in transform post-processors.
export {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
  restrictToWindowEdges,
  restrictToParentElement,
  snapToGrid,
  type Modifier,
  type ModifierContext,
} from './modifiers/index.js'

// Types.
export type {
  Id,
  Point,
  Translate,
  Rect,
  Draggable,
  Container,
  Collision,
  CollisionStrategy,
  DragState,
  DragStatus,
} from './core/types.js'