/**
 * Built-in collision strategies. Pure math, no DOM access.
 *
 * Two strategies are exported:
 * - `sortableStrategy` (default): closest-center within the active's container.
 *   Best for reorderable lists.
 * - `rectIntersectionStrategy`: rect overlap, sorted by area. Best for
 *   kanban-style cross-container drop targets.
 *
 * Both are O(n) in the number of registered items. Safe to call every frame.
 */

import type { CollisionStrategy, Id, Rect } from './types.js'

/**
 * Sortable — closest item by center distance, within the active's container.
 *
 * Center distance (vs rect overlap) gives a stable, monotonic "closest wins"
 * answer every frame, which matches how native iOS/Android reorder feels.
 */
export const sortableStrategy: CollisionStrategy = ({
  activeRect,
  activeId,
  activeContainerId,
  containers,
  rects,
  previousCollision,
}) => {
  // Find the container the active item is in. Prefer:
  // 1. previousCollision (stable across frames) — but only if the collision
  //    points to a CONTAINER, not an item. previousCollision is an item id.
  //    We resolve it back to its container.
  // 2. the active's own container (works when scrolled out of view)
  // 3. container with the most rect overlap
  let containerId: Id | null = null
  if (previousCollision) {
    // previousCollision is an item id; find the container that owns it.
    containerId = containers.find((c) => c.items.includes(previousCollision.id))?.id ?? null
  } else if (activeContainerId != null) {
    containerId = activeContainerId
  } else {
    let bestOverlap = 0
    for (const c of containers) {
      const r = rects.get(c.id)
      if (!r) continue
      const ox = Math.max(0, Math.min(activeRect.right, r.right) - Math.max(activeRect.left, r.left))
      const oy = Math.max(0, Math.min(activeRect.bottom, r.bottom) - Math.max(activeRect.top, r.top))
      const area = ox * oy
      // Use >= so we pick the LAST container when all areas are 0
      // (e.g. happy-dom test environment, or all-zero rects).
      if (area >= bestOverlap) {
        bestOverlap = area
        containerId = c.id
      }
    }
  }
  if (containerId === null) return []
  const container = containers.find((c) => c.id === containerId)
  if (!container) return []

  const cx = (activeRect.left + activeRect.right) / 2
  const cy = (activeRect.top + activeRect.bottom) / 2

  let bestId: Id | null = null
  let bestDist = Infinity
  for (const itemId of container.items) {
    if (itemId === activeId) continue
    const r = rects.get(itemId)
    if (!r) continue
    const dx = (r.left + r.right) / 2 - cx
    const dy = (r.top + r.bottom) / 2 - cy
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      bestId = itemId
    }
  }
  if (bestId === null) return []
  const bestRect = rects.get(bestId)
  if (!bestRect) return []
  return [{ id: bestId, value: -bestDist, rect: bestRect }]
}

/**
 * Rect intersection — for kanban-style multi-container drop targets.
 * Returns all overlapping containers sorted by overlap area (largest first).
 */
export const rectIntersectionStrategy: CollisionStrategy = ({
  activeRect,
  containers,
  rects,
}) => {
  const out: { id: Id; value: number; rect: Rect }[] = []
  for (const c of containers) {
    if (c.disabled) continue
    const r = rects.get(c.id)
    if (!r) continue
    const ox = Math.max(0, Math.min(activeRect.right, r.right) - Math.max(activeRect.left, r.left))
    const oy = Math.max(0, Math.min(activeRect.bottom, r.bottom) - Math.max(activeRect.top, r.top))
    const area = ox * oy
    if (area > 0) out.push({ id: c.id, value: area, rect: r })
  }
  out.sort((a, b) => b.value - a.value)
  return out
}

/** Pure math: project a rect by a translate. */
export function projectRect(r: Rect, t: { x: number; y: number }): Rect {
  return {
    top: r.top + t.y,
    left: r.left + t.x,
    right: r.right + t.x,
    bottom: r.bottom + t.y,
    width: r.width,
    height: r.height,
  }
}

/** Read a rect from a DOM element, returning a plain object. */
export function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
}

/**
 * Closest-center, global (across all containers). Returns the nearest item
 * by Euclidean center distance. Great for kanban where you want to drop
 * onto the nearest card regardless of which column it's in.
 */
export const closestCenterStrategy: CollisionStrategy = ({
  activeRect,
  activeId,
  containers,
  rects,
  previousCollision,
}) => {
  let containerId: Id | null = null
  let bestId: Id | null = null
  let bestDist = Infinity

  // Use the same container the active was in (or the one the previous collision
  // pointed to) as a tie-breaker: we prefer same-column items for stable
  // same-column reorder, but allow cross-column as soon as the cursor is
  // genuinely closer to a card in another column.
  if (previousCollision) {
    containerId = containers.find((c) => c.items.includes(previousCollision.id))?.id ?? null
  }

  const cx = (activeRect.left + activeRect.right) / 2
  const cy = (activeRect.top + activeRect.bottom) / 2

  for (const c of containers) {
    if (c.disabled) continue
    for (const itemId of c.items) {
      if (itemId === activeId) continue
      const r = rects.get(itemId)
      if (!r) continue
      const dx = (r.left + r.right) / 2 - cx
      const dy = (r.top + r.bottom) / 2 - cy
      const dist = dx * dx + dy * dy
      // Same-column items get a small bonus (lower distance) so column-internal
      // reorder stays stable even when the cursor drifts toward another column.
      const adj = containerId != null && c.id === containerId ? dist * 0.95 : dist
      if (adj < bestDist) {
        bestDist = adj
        bestId = itemId
      }
    }
  }
  if (bestId == null) return []
  const bestRect = rects.get(bestId)
  if (!bestRect) return []
  return [{ id: bestId, value: -bestDist, rect: bestRect }]
}
