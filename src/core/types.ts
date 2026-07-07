/**
 * kinetik — core types.
 *
 * IDs are opaque strings/numbers. Rects are plain objects (not DOMRect) for
 * memory and performance. The core is framework-agnostic.
 */

/** Opaque identifier. Strings are preferred (better DevTools, equality). */
export type Id = string | number

/** 2D coordinates in viewport space (pixels). */
export interface Point {
  x: number
  y: number
}

/** A translation applied to an element via CSS transform. */
export interface Translate {
  x: number
  y: number
}

/** Plain rectangle in viewport coordinates. Cheaper than DOMRect. */
export interface Rect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

/** A draggable node — registered with the engine. */
export interface Draggable {
  id: Id
  el: HTMLElement
  /** Container this item belongs to (set via context or prop). */
  containerId: Id | null
  /** Whether the user can drag this node. */
  disabled: boolean
  /** Cached rect at the moment drag started (or registration). */
  initialRect: Rect
  /** Current applied transform. */
  transform: Translate
}

/** A droppable container — holds draggables. */
export interface Container {
  id: Id
  el: HTMLElement
  disabled: boolean
  /** Cached rect. */
  rect: Rect
  /** Items in render order. */
  items: Id[]
  /** Whether the container should pan-scroll when dragging near edges. */
  autoScroll: boolean
}

/** Result of a collision check. */
export interface Collision {
  id: Id
  /** Higher = more relevant. Strategy-defined. */
  value: number
  rect: Rect
}

/** Drag lifecycle status. */
export type DragStatus = 'idle' | 'pending' | 'dragging' | 'dropping' | 'cancelled'

/** Public drag state. */
export interface DragState {
  status: DragStatus
  activeId: Id | null
  /** The container the active item currently belongs to. */
  activeContainerId: Id | null
  /** Cursor delta from initialCursor. */
  delta: Translate
  /** Items the active item is currently overlapping (collision results). */
  collisions: Id[]
  /** The top collision (where the user would "drop" by default). */
  overId: Id | null
  /** Current cursor position in viewport coords. */
  currentCursor: Point
  /** Pointer velocity in px/s — updated on every drag frame. */
  velocity: Point
}

/** Function signature for collision detection strategies. */
export type CollisionStrategy = (args: {
  activeRect: Rect
  activeId: Id
  activeContainerId: Id | null
  containers: Container[]
  rects: Map<Id, Rect>
  previousCollision: Collision | null
  /**
   * Optional predictive cursor rect (~60ms ahead) — strategies that want
   * the iOS-springboard feel can pick the snap-ahead instead of the
   * current cursor position. Power users / custom strategies only.
   */
  hint?: Rect
}) => Collision[]
