/**
 * 'kinetik/core' — framework-agnostic engine entry point.
 *
 *   import { DragEngine, sortableStrategy, springTo } from 'kinetik/core'
 *
 * Use this when you don't need React. The core is ~12 KB gzipped and depends
 * on nothing.
 */
export { DragEngine, type EngineOptions, type EngineEvents } from './engine.js'
export {
  sortableStrategy,
  rectIntersectionStrategy,
  closestCenterStrategy,
  projectRect,
  readRect,
} from './collision.js'
export {
  springTo,
  captureFlip,
  defaultSpring,
  bouncySpring,
  computeAutoScroll,
  type SpringConfig,
  type AnimationHandle,
  type FlipSnapshot,
} from './animator.js'
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
} from './types.js'