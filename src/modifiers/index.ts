/**
 * Modifiers — pure functions that post-process a Rect.
 *
 * Use them via the `modifiers` prop on `<DndContext>` or the `modifiers`
 * option of `new DragEngine(...)`.
 *
 * ```ts
 * <DndContext modifiers={[restrictToVerticalAxis, snapToGrid(8)]}>
 *   ...
 * </DndContext>
 * ```
 */
import type { Rect } from '../core/types.js'

export interface ModifierContext {
  rect: Rect
  velocity?: { x: number; y: number }
  el?: HTMLElement
}

export type Modifier = (ctx: ModifierContext) => Rect

const initialRects = new WeakMap<HTMLElement, Rect>()

/** Internal helper — store the original rect at the start of a drag so
 *  axis-restricting modifiers have a reference to "where the element was". */
export function setInitialRect(el: HTMLElement, rect: Rect): void {
  initialRects.set(el, rect)
}

/** Get the initial rect that was set for an element. Returns undefined if none. */
export function getInitialRect(el: HTMLElement | undefined): Rect | undefined {
  return el ? initialRects.get(el) : undefined
}

/** Restrict movement to the horizontal axis (X). The element can slide left/right
 *  but never up/down — its Y stays at the initial drag position.
 *
 *  Useful for sortable lists in a fixed-height column.
 */
export const restrictToHorizontalAxis: Modifier = ({ rect, el }) => {
  const init = getInitialRect(el)
  if (!init) return rect
  return {
    ...rect,
    top: init.top,
    bottom: init.bottom,
    height: init.height,
  }
}

/** Restrict movement to the vertical axis (Y). The element can slide up/down
 *  but never left/right — its X stays at the initial drag position.
 */
export const restrictToVerticalAxis: Modifier = ({ rect, el }) => {
  const init = getInitialRect(el)
  if (!init) return rect
  return {
    ...rect,
    left: init.left,
    right: init.right,
    width: init.width,
  }
}

/** Clamp the dragged rect inside the viewport. */
export const restrictToWindowEdges: Modifier = (ctx) => {
  const w = typeof window !== 'undefined' ? window.innerWidth : Infinity
  const h = typeof window !== 'undefined' ? window.innerHeight : Infinity
  const r = ctx.rect
  const left = Math.max(0, Math.min(r.left, w - r.width))
  const top = Math.max(0, Math.min(r.top, h - r.height))
  return {
    ...r,
    left,
    top,
    right: left + r.width,
    bottom: top + r.height,
  }
}

/** Clamp the dragged rect inside its parent's bounding box. */
export const restrictToParentElement: Modifier = ({ rect, el }) => {
  if (!el || !el.parentElement) return rect
  const parent = el.parentElement.getBoundingClientRect()
  const left = Math.max(parent.left, Math.min(rect.left, parent.right - rect.width))
  const top = Math.max(parent.top, Math.min(rect.top, parent.bottom - rect.height))
  return {
    ...rect,
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
  }
}

/** Snap the rect to a grid. `size` is the grid cell in pixels. */
export function snapToGrid(size: number): Modifier {
  return ({ rect }) => {
    const left = Math.round(rect.left / size) * size
    const top = Math.round(rect.top / size) * size
    return {
      ...rect,
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
    }
  }
}
