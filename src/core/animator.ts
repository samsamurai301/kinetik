import type { Rect } from './types.js'
import { readRect } from './collision.js'
/**
 * Animation primitives — spring physics and FLIP reorder.
 *
 * Both writers are `transform`-only, so they don't trigger layout or paint
 * on siblings. The browser's compositor handles the visual update.
 */

/** Spring config. Defaults feel "snappy with mild overshoot" for UI. */
export interface SpringConfig {
  stiffness: number
  damping: number
  mass: number
  /** Stop when both position error and velocity are below this. */
  precision: number
}

export const defaultSpring: SpringConfig = {
  stiffness: 0.18,
  damping: 0.78,
  mass: 1,
  precision: 0.4,
}

/** Bouncier config for "snap back to origin" on cancel. */
export const bouncySpring: SpringConfig = {
  stiffness: 0.12,
  damping: 0.55,
  mass: 1,
  precision: 0.4,
}

export interface AnimationHandle {
  cancel(): void
  finished: Promise<void>
}

/** Map of element → its current animation, so new animations replace old ones. */
const active = new WeakMap<HTMLElement, AnimationHandle>()

/**
 * Spring-animate an element's translate to (toX, toY). Reads the element's
 * current transform as the starting point so we never jump.
 */
export function springTo(
  el: HTMLElement,
  toX: number,
  toY: number,
  config: SpringConfig = defaultSpring,
): AnimationHandle {
  const start = parseTranslate(el)
  let x = start.x
  let y = start.y
  let vx = 0
  let vy = 0

  const prior = active.get(el)
  if (prior) prior.cancel()

  let rafId = 0
  let cancelled = false
  let resolve!: () => void
  const finished = new Promise<void>((r) => (resolve = r))

  let frames = 0
  // Safety cap so test environments with rapid rAF (0ms apart) eventually settle.
  const maxFrames = 40
  const tick = (): void => {
    if (cancelled) return
    frames++
    const dx = toX - x
    const dy = toY - y
    vx += (config.stiffness * dx - config.damping * vx) / config.mass
    vy += (config.stiffness * dy - config.damping * vy) / config.mass
    x += vx
    y += vy
    if (
      frames >= maxFrames ||
      (Math.abs(dx) < config.precision &&
        Math.abs(dy) < config.precision &&
        Math.abs(vx) < config.precision &&
        Math.abs(vy) < config.precision)
    ) {
      writeTransform(el, toX, toY)
      active.delete(el)
      resolve()
      return
    }
    writeTransform(el, x, y)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  const handle: AnimationHandle = {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      cancelAnimationFrame(rafId)
      active.delete(el)
      resolve()
    },
    finished,
  }
  active.set(el, handle)
  return handle
}

function writeTransform(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

function parseTranslate(el: HTMLElement): { x: number; y: number } {
  const t = el.style.transform
  if (!t || t === 'none') return { x: 0, y: 0 }
  const m = /translate3d?\(([-\d.]+)px,\s*([-\d.]+)px/.exec(t)
  return m ? { x: parseFloat(m[1]!), y: parseFloat(m[2]!) } : { x: 0, y: 0 }
}

// ---------------------------------------------------------------------------
// FLIP — First, Last, Invert, Play
// ---------------------------------------------------------------------------

/**
 * Capture pre-update rects. After mutating the DOM, call `.play()` to
 * smoothly animate each element from its old position to its new one.
 *
 * `captureFlip` is the only place we read layout for FLIP — it runs after
 * a React commit, never inside a drag frame.
 */
export function captureFlip(elements: Iterable<HTMLElement>): FlipSnapshot {
  const first = new Map<HTMLElement, Rect>()
  for (const el of elements) first.set(el, readRect(el))

  return {
    firstRects: first,
    async play(config: SpringConfig = defaultSpring): Promise<void> {
      // Wait two frames so the DOM has settled into its new layout.
      await nextFrame()
      await nextFrame()
      const animations: AnimationHandle[] = []
      for (const [el, before] of first) {
        const after = readRect(el)
        const dx = before.left - after.left
        const dy = before.top - after.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
        // Invert: snap to the old position, then spring back to identity.
        writeTransform(el, dx, dy)
        // Force a reflow so the browser commits the inverted transform
        // before we start the spring from it. Without this the spring
        // would start from the new position, not the inverted one.
        void el.offsetWidth
        animations.push(springTo(el, 0, 0, config))
      }
      await Promise.all(animations.map((a) => a.finished))
    },
  }
}

export interface FlipSnapshot {
  readonly firstRects: Map<HTMLElement, Rect>
  play(config?: SpringConfig): Promise<void>
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

// ---------------------------------------------------------------------------
// Auto-scroll near container edges
// ---------------------------------------------------------------------------

/**
 * Compute the scroll delta to apply this frame based on cursor proximity to
 * the container edges. Returns null if no scroll is needed.
 *
 * Used by the engine when an item is dragged near a scrollable container's
 * edge — gives the "drag-to-scroll" feel from native file managers.
 */
export function computeAutoScroll(
  cursor: { x: number; y: number },
  rect: Rect,
  maxOrVelocity?: number | { vx?: number; vy?: number; lookAheadMs?: number },
  threshold = 30,
): { x: number; y: number } | null {
  let max = 8
  // Back-compat: 3rd arg as number = pixel cap, 4th = threshold.
  // New: 3rd arg as object = velocity data for predictive scroll.
  let extra: { vx?: number; vy?: number; lookAheadMs?: number } | null = null
  if (typeof maxOrVelocity === 'number') {
    max = maxOrVelocity
  } else if (maxOrVelocity && typeof maxOrVelocity === 'object') {
    extra = maxOrVelocity
    max = 10 // a touch more aggressive when predictive
  }

  let dx = 0
  let dy = 0
  // If we have velocity data and the gesture is heading toward an edge
  // dead zone, start scrolling *now*, before the cursor crosses the threshold.
  let predictiveBoost = 0
  if (extra) {
    const lookAhead = (extra.lookAheadMs ?? 60) / 1000
    const predX = cursor.x + (extra.vx ?? 0) * lookAhead
    const predY = cursor.y + (extra.vy ?? 0) * lookAhead
    // Get closer to threshold if cursor is heading toward edge.
    if (extra.vx != null && extra.vx < 0 && cursor.x >= rect.left + threshold * 0.5 && predX < rect.left + threshold) predictiveBoost = 0.3
    if (extra.vx != null && extra.vx > 0 && cursor.x <= rect.right - threshold * 0.5 && predX > rect.right - threshold) predictiveBoost = 0.3
    if (extra.vy != null && extra.vy < 0 && cursor.y >= rect.top + threshold * 0.5 && predY < rect.top + threshold) predictiveBoost = 0.3
    if (extra.vy != null && extra.vy > 0 && cursor.y <= rect.bottom - threshold * 0.5 && predY > rect.bottom - threshold) predictiveBoost = 0.3
  }
  const effectiveThreshold = threshold * (1 - predictiveBoost)

  if (cursor.x < rect.left + effectiveThreshold) dx = -max * easeIn((rect.left + effectiveThreshold - cursor.x) / effectiveThreshold)
  else if (cursor.x > rect.right - effectiveThreshold) dx = max * easeIn((cursor.x - (rect.right - effectiveThreshold)) / effectiveThreshold)
  if (cursor.y < rect.top + effectiveThreshold) dy = -max * easeIn((rect.top + effectiveThreshold - cursor.y) / effectiveThreshold)
  else if (cursor.y > rect.bottom - effectiveThreshold) dy = max * easeIn((cursor.y - (rect.bottom - effectiveThreshold)) / effectiveThreshold)
  return dx === 0 && dy === 0 ? null : { x: dx, y: dy }
}

function easeIn(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c
}


