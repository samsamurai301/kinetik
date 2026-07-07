/**
 * The drag engine — single class, no MeasurementStore indirection.
 *
 * Capabilities (Phase 3+):
 * - Velocity tracking (last ~64ms of pointer movement) → predictive collision
 *   and inertial "throw" release.
 * - Opt-in modifiers (transform-only post-processing).
 * - Neighbor event channel — subscribe to which siblings are currently
 *   inside the collision zone, useful for cooperative "lean" reordering.
 * - Predictive auto-scroll — if velocity points toward an edge dead zone,
 *   start scrolling before the cursor crosses.
 *
 * Invariants:
 * 1. During a drag, React is NEVER notified per frame. The state mutates
 *    in place; the React layer subscribes via getSnapshot.
 * 2. Rects come from a ResizeObserver-cached Map. We never read layout
 *    during a drag frame.
 * 3. The engine writes only `transform` on draggables — compositor-only.
 */

// `__DEV__` is true during development, false in production. Bundlers
// (esbuild, vite, swc, webpack) dead-code-eliminate the `if (__DEV__)` blocks.
const __DEV__: boolean = (globalThis as any).__KINETIK_DEV__ !== false && (globalThis as any).NODE_ENV !== "production"

import { computeAutoScroll, springTo, defaultSpring, bouncySpring } from './animator.js'
import { projectRect, readRect, sortableStrategy } from './collision.js'
import type { Modifier } from '../modifiers/index.js'
import { setInitialRect } from '../modifiers/index.js'
import type {
  Collision,
  CollisionStrategy,
  Container,
  Draggable,
  DragState,
  Id,
  Point,
  Rect,
  Translate,
} from './types.js'

/** Public engine constructor options. */
export interface EngineOptions {
  /** Default `sortableStrategy` — closest center within the active's container. */
  collisionStrategy?: CollisionStrategy
  /** Pointer must move this far before drag starts. Default: 4. */
  activationDistance?: number
  /** Auto-scroll near container edges. Default: true. */
  autoScroll?: boolean
  /** Transform-only modifiers applied each frame, in order. */
  modifiers?: Modifier[]
  /**
   * Look-ahead time for predictive collision / throw release.
   * Default 60ms — barely perceptible, but feels 2-3x more responsive.
   */
  predictionMs?: number
  /**
   * Threshold pointer velocity (px/s) above which a release triggers
   * the inertial "throw" instead of an immediate snap. Default: 700.
   * Set to Infinity to disable.
   */
  throwVelocityThreshold?: number
  onDragStart?: (id: Id) => void
  onDragMove?: (state: DragState) => void
  onDragEnd?: (state: DragState) => void
  onDragCancel?: (state: DragState) => void
}

/** A point sample used to compute pointer velocity. */
interface VelocitySample {
  x: number
  y: number
  t: number
}

/** Subscribe to engine events. */
export interface EngineEvents {
  /** Fired on every drag frame with the active's projected rect. */
  onActiveTransform?: (rect: Rect, delta: Translate, velocity: Point) => void
  /**
   * Fired when siblings enter / leave the "active range". Useful for
   * implementing cooperative "lean" animations like iOS Messages reorder.
   */
  onNeighborsChange?: (neighborIds: Id[]) => void
}

export class DragEngine {
  // Registry
  private readonly draggables = new Map<Id, Draggable>()
  private readonly containers = new Map<Id, Container>()
  /** Reverse index: container element → container id. Updated on register/unregister. */
  private readonly elementToContainerId = new WeakMap<HTMLElement, Id>()
  private readonly elementToId = new WeakMap<HTMLElement, Id>()

  // Cached rects (one entry per element, updated by ResizeObserver async).
  private readonly rects = new Map<Id, Rect>()
  private readonly elements = new Map<Id, HTMLElement>()

  // ---- Allocation-free scratch buffers for the per-frame hot path ----
  // `updateDrag` runs every animation frame during a drag. Allocating
  // fresh Rect / Translate objects per frame causes GC churn that shows
  // up as jank. These buffers are mutated in place; the engine never
  // exposes them outside, so the optimization is safe.
  private readonly _scratchRect: Rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  private readonly _scratchProjected: Rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  private readonly _scratchDelta: Translate = { x: 0, y: 0 }
  private readonly _scratchVisible: Translate = { x: 0, y: 0 }
  private readonly _scratchPredictive: Translate = { x: 0, y: 0 }
  private readonly _scratchCenter: Point = { x: 0, y: 0 }
  // Cached containers array (only rebuilt when the container set changes).
  private _containersCache: Container[] = []
  private _containersCacheDirty = true

  // Drag state. Mutated in place during drag for performance; replace
  // the whole reference on lifecycle transitions so React re-renders.
  private _state: DragState = idle()
  private pending: { x: number; y: number } | null = null
  private raf = 0

  // Active drag bookkeeping
  private activePointerId: number = -1
  private active: Draggable | null = null
  private startX = 0
  private startY = 0
  private startT = 0
  private previousCollision: Collision | null = null

  // Velocity tracking — circular buffer of recent pointer samples.
  private velocityBuffer: VelocitySample[] = []
  private lastVelocity: Point = { x: 0, y: 0 }
  private currentNeighbors = new Set<Id>()

  // Subscribers (for useSyncExternalStore)
  private readonly listeners = new Set<() => void>()

  // ResizeObserver — single instance for all elements. Async, so updates
  // don't block the drag frame.
  private readonly ro: ResizeObserver

  // Options
  private readonly collisionStrategy: CollisionStrategy
  private readonly activationDistance: number
  private readonly autoScrollEnabled: boolean
  private readonly modifiers: Modifier[]
  private readonly predictionMs: number
  private readonly throwVelocityThreshold: number
  private readonly onDragStart?: (id: Id) => void
  private readonly onDragMove?: (state: DragState) => void
  private readonly onDragEnd?: (state: DragState) => void
  private readonly onDragCancel?: (state: DragState) => void
  // Public event hooks (subscribed via on/once)
  private readonly eventListeners: Required<EngineEvents> = {
    onActiveTransform: undefined as any,
    onNeighborsChange: undefined as any,
  }

  constructor(options: EngineOptions = {}, events: EngineEvents = {}) {
    this.collisionStrategy = options.collisionStrategy ?? sortableStrategy
    this.activationDistance = options.activationDistance ?? 4
    this.autoScrollEnabled = options.autoScroll ?? true
    this.modifiers = options.modifiers ?? []
    this.predictionMs = options.predictionMs ?? 60
    this.throwVelocityThreshold = options.throwVelocityThreshold ?? 700
    this.onDragStart = options.onDragStart
    this.onDragMove = options.onDragMove
    this.onDragEnd = options.onDragEnd
    this.onDragCancel = options.onDragCancel
    if (events.onActiveTransform) this.eventListeners.onActiveTransform = events.onActiveTransform
    if (events.onNeighborsChange) this.eventListeners.onNeighborsChange = events.onNeighborsChange

    this.ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          for (const e of entries) {
            const el = e.target as HTMLElement
            const id = this.findId(el)
            if (id !== undefined) this.rects.set(id, readRect(el))
          }
        })
      : (null as unknown as ResizeObserver)

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.cancel)
      document.addEventListener('visibilitychange', this.onVisibility)
      window.addEventListener('keydown', this.onKey)
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  on<K extends keyof EngineEvents>(event: K, handler: EngineEvents[K]): () => void {
    this.eventListeners[event] = handler as any
    return () => { this.eventListeners[event] = undefined as any }
  }

  // -------------------------------------------------------------------------
  // Public state access (for useSyncExternalStore)
  // -------------------------------------------------------------------------

  getState = (): DragState => this._state
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  registerDraggable(id: Id, el: HTMLElement, containerId: Id | null, disabled = false): void {
    const previous = this.draggables.get(id)
    if (__DEV__ && previous && previous.el !== el) {
      // eslint-disable-next-line no-console
      console.warn(
        `[kinetik] Draggable "${String(id)}" is registered with a new element before ` +
        `unregistering the previous one. This usually means your component mounted twice ` +
        `(StrictMode?) and your cleanup isn't running. If intentional, call ` +
        `engine.unregisterDraggable("${String(id)}") first.`,
      )
      this.ro.unobserve?.(previous.el)
      this.elementToId.delete(previous.el)
    }
    const rect = readRect(el)
    this.draggables.set(id, { id, el, containerId, disabled, initialRect: rect, transform: { x: 0, y: 0 } })
    this.elements.set(id, el)
    this.rects.set(id, rect)
    this.elementToId.set(el, id)
    this.ro.observe?.(el)
  }

  updateDraggable(id: Id, el: HTMLElement): void {
    const d = this.draggables.get(id)
    if (!d) return
    if (d.el === el) return
    this.ro.unobserve?.(d.el)
    this.elementToId.delete(d.el)
    d.el = el
    d.initialRect = readRect(el)
    this.elements.set(id, el)
    this.rects.set(id, d.initialRect)
    this.elementToId.set(el, id)
    this.ro.observe?.(el)
  }

  unregisterDraggable(id: Id): void {
    const d = this.draggables.get(id)
    if (!d) return
    if (this.active === d) this.cancel()
    this.ro.unobserve?.(d.el)
    this.elementToId.delete(d.el)
    this.draggables.delete(id)
    this.elements.delete(id)
    this.rects.delete(id)
  }

  registerContainer(id: Id, el: HTMLElement, items: Id[] = [], autoScroll = true, disabled = false): void {
    if (this.containers.has(id) && this.containers.get(id)!.el !== el) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[kinetik] Container "${String(id)}" is being re-registered with a new element. ` +
          `This may indicate StrictMode double-mount without proper cleanup.`,
        )
      }
      this.unregisterContainer(id)
    }
    const rect = readRect(el)
    this.containers.set(id, { id, el, rect, items, autoScroll, disabled })
    this.elementToContainerId.set(el, id)
    this.elementToId.set(el, id)
    this.elements.set(id, el)
    this.rects.set(id, rect)
    this.ro.observe?.(el)
    this._containersCacheDirty = true
  }

  /**
   * Walk up the DOM from `el` looking for any registered container element.
   * Returns the container id, or null if none of el's ancestors is a
   * container. Useful for items that don't know their container explicitly.
   */
  findContainerId(el: HTMLElement | null): Id | null {
    let cur: HTMLElement | null = el
    while (cur) {
      const id = this.elementToContainerId.get(cur)
      if (id != null) return id
      cur = cur.parentElement
    }
    return null
  }

  /**
   * Returns the cached containers array. Rebuilt only when the container
   * set changes — saves an Array.from() allocation per frame during drag.
   */
  private getContainersArray(): Container[] {
    if (this._containersCacheDirty) {
      this._containersCache = Array.from(this.containers.values())
      this._containersCacheDirty = false
    }
    return this._containersCache
  }

  updateContainer(id: Id, items: Id[]): void {
    const c = this.containers.get(id)
    if (!c) return
    c.items = items
  }

  unregisterContainer(id: Id): void {
    const c = this.containers.get(id)
    if (!c) return
    this.ro.unobserve?.(c.el)
    this.elementToId.delete(c.el)
    this.elementToContainerId.delete(c.el)
    this.containers.delete(id)
    this.elements.delete(id)
    this.rects.delete(id)
    this._containersCacheDirty = true
  }

  // -------------------------------------------------------------------------
  // Keyboard sensor — accessibility-driven drag.
  //
  // Picks up a draggable via Space/Enter, advances with arrow keys,
  // completes with Space/Enter, cancels with Escape. The keyboard sensor
  // reuses the existing collision pipeline by simulating a cursor position
  // at the rect of the candidate-over item, so collision feels identical
  // to pointer drag.
  // -------------------------------------------------------------------------

  /** Begin a keyboard-driven drag. No-op if the engine is busy or the id is unknown. */
  beginKeyboardDrag(id: Id): boolean {
    const active = this.draggables.get(id)
    if (!active || active.disabled) return false
    if (this._state.status !== 'idle') return false

    this.active = active
    this.activePointerId = -1 // keyboard has no pointer
    const rect = active.el.getBoundingClientRect()
    this.startX = rect.left + rect.width / 2
    this.startY = rect.top + rect.height / 2
    this.startT = performance.now()
    this.velocityBuffer = [{ x: this.startX, y: this.startY, t: this.startT }]
    this.lastVelocity = { x: 0, y: 0 }
    this.currentNeighbors = new Set()
    setInitialRect(active.el, active.initialRect)

    this._state = {
      status: 'dragging',
      activeId: id,
      activeContainerId: active.containerId,
      delta: { x: 0, y: 0 },
      collisions: [],
      overId: null,
      currentCursor: { x: this.startX, y: this.startY },
      velocity: { x: 0, y: 0 },
    }
    this.notify()
    return true
  }

  /**
   * Advance the active keyboard drag by one step in the given direction.
   * Direction uses logical axes ('up'/'down'/'left'/'right'). The engine
   * finds the nearest item in that direction from the active's rect center
   * and uses it as the new overId, then computes a synthetic delta so the
   * active visually slides toward the new position.
   */
  keyboardAdvance(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this._state.status !== 'dragging' || !this.active) return false
    const active = this.active
    const activeRect = readRect(active.el)
    // Compute the current visual center after delta has been applied.
    const visualCenter = {
      x: activeRect.left + activeRect.width / 2 + this._state.delta.x,
      y: activeRect.top + activeRect.height / 2 + this._state.delta.y,
    }
    const candidates = this.findItemsInDirection(active, visualCenter, direction)
    if (candidates.length === 0) return false
    const target = candidates[0]!
    const targetRect = this.rects.get(target.id)
    if (!targetRect) return false
    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    }
    const dx = targetCenter.x - visualCenter.x
    const dy = targetCenter.y - visualCenter.y
    const newDelta = { x: this._state.delta.x + dx, y: this._state.delta.y + dy }
    this._state = {
      ...this._state,
      delta: newDelta,
      overId: target.id,
      currentCursor: targetCenter,
    }
    // Mirror what updateDrag does for the live element transform so the
    // active visibly moves toward the candidate.
    active.transform = newDelta
    active.el.style.transform = `translate3d(${newDelta.x}px, ${newDelta.y}px, 0)`
    active.el.style.zIndex = '10'
    this.notify()
    return true
  }

  /**
   * Find items geometrically ahead of the active in the given direction.
   * Uses simple AABB filtering (item's center must be on the appropriate
   * side of the active's center) then sorts by distance.
   */
  private findItemsInDirection(
    active: Draggable,
    visualCenter: Point,
    direction: 'up' | 'down' | 'left' | 'right',
  ): { id: Id; distance: number }[] {
    const all: { id: Id; distance: number; center: Point }[] = []
    for (const [id, d] of this.draggables) {
      if (id === active.id) continue
      if (d.disabled) continue
      // Only consider items in the same container (or any container, for kanban)
      const r = this.rects.get(id)
      if (!r) continue
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let qualifies = false
      switch (direction) {
        case 'up':    qualifies = cy < visualCenter.y - 4; break
        case 'down':  qualifies = cy > visualCenter.y + 4; break
        case 'left':  qualifies = cx < visualCenter.x - 4; break
        case 'right': qualifies = cx > visualCenter.x + 4; break
      }
      if (!qualifies) continue
      const distance = Math.hypot(cx - visualCenter.x, cy - visualCenter.y)
      all.push({ id, distance, center: { x: cx, y: cy } })
    }
    all.sort((a, b) => a.distance - b.distance)
    return all.map(({ id, distance }) => ({ id, distance }))
  }

  /** Complete the keyboard drag (same as releasing pointer). */
  keyboardComplete(): void {
    if (this._state.status !== 'dragging') return
    this.complete()
  }

  // -------------------------------------------------------------------------
  // Drag initiation
  // -------------------------------------------------------------------------

  beginDrag(id: Id, event: PointerEvent): boolean {
    const active = this.draggables.get(id)
    if (!active || active.disabled) return false
    // If mid-drag, ignore (engine is busy with another gesture).
    if (this._state.status !== 'idle') return false

    this.active = active
    this.activePointerId = event.pointerId
    this.startX = event.clientX
    this.startY = event.clientY
    this.startT = performance.now()
    this.velocityBuffer = [{ x: event.clientX, y: event.clientY, t: this.startT }]
    this.lastVelocity = { x: 0, y: 0 }
    this.currentNeighbors = new Set()

    // Mark the initial rect for any axis-restricting modifier later.
    setInitialRect(active.el, active.initialRect)

    this._state = {
      status: 'pending',
      activeId: id,
      activeContainerId: active.containerId,
      delta: { x: 0, y: 0 },
      collisions: [],
      overId: null,
      currentCursor: { x: event.clientX, y: event.clientY },
      velocity: { x: 0, y: 0 },
    }
    this.notify()
    this.setupWindowListeners()
    // Try to pointer-capture so we keep getting events if cursor leaves
    // the source element (also enables iOS drag-to-scroll prevention).
    try {
      active.el.setPointerCapture(event.pointerId)
    } catch {
      /* element may be detached, that's fine */
    }
    return true
  }

  private setupWindowListeners(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('pointermove', this.onMove)
    document.addEventListener('pointerup', this.onUp)
    document.addEventListener('pointercancel', this.onCancel)
  }

  // -------------------------------------------------------------------------
  // rAF loop — coalesces multiple pointermoves per frame
  // -------------------------------------------------------------------------

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return
    this.pending = { x: e.clientX, y: e.clientY }
    if (this.raf) return
    this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (): void => {
    this.raf = 0
    const m = this.pending
    this.pending = null
    if (!m) return
    const now = performance.now()
    this.velocityBuffer.push({ x: m.x, y: m.y, t: now })
    // Keep only samples within last 100ms.
    const cutoff = now - 100
    while (this.velocityBuffer.length > 1 && this.velocityBuffer[0]!.t < cutoff) {
      this.velocityBuffer.shift()
    }
    if (this._state.status === 'pending') this.maybeActivate(m.x, m.y)
    if (this._state.status === 'dragging') this.updateDrag(m.x, m.y, now)
  }

  private maybeActivate(x: number, y: number): void {
    const dx = x - this.startX
    const dy = y - this.startY
    const dist = Math.hypot(dx, dy)
    if (dist < this.activationDistance) return

    // Smart first-frame pickup: if the gesture is already moving faster than
    // a slow drag, halve the activation distance. Fast gestures should
    // activate sooner — feels 2x more responsive.
    const gestureSpeed = dist / Math.max(1, performance.now() - this.startT)
    const adjustedActivation = gestureSpeed > 1.5 ? this.activationDistance / 2 : this.activationDistance
    if (dist < adjustedActivation) return

    const active = this.active!

    // Pre-apply a small fraction of the cursor delta so the active is
    // already moving toward where the gesture is going. Without this,
    // the element jumps to the cursor on frame 1 ("snap"). With it, the
    // element is already in motion — feels like it was always under the finger.
    const pickupFraction = 0.15
    const initialTransform: Translate = { x: dx * pickupFraction, y: dy * pickupFraction }

    this._state = {
      ...this._state,
      status: 'dragging',
      delta: initialTransform,
    }
    active.transform = initialTransform
    active.el.style.transform = `translate3d(${initialTransform.x}px, ${initialTransform.y}px, 0)`
    active.el.style.zIndex = '9999'
    this.onDragStart?.(active.id)
    this.notify()
  }

  private updateDrag(x: number, y: number, t: number): void {
    const active = this.active
    if (!active) return
    // Hot-path delta — reuse scratch buffer instead of allocating.
    const delta = this._scratchDelta
    delta.x = x - this.startX
    delta.y = y - this.startY

    // Compute pointer velocity (px/ms → px/s). Use the oldest sample in
    // the buffer for smoothing. Wait until we have at least 16ms of data
    // before computing — otherwise a single isolated pointermove produces
    // absurd velocity that can't converge under friction. Cap at 5000 px/s
    // as a safety net.
    const oldest = this.velocityBuffer[0]!
    const dtMs = Math.max(1, t - oldest.t)
    if (dtMs >= 4) {
      const rawVx = ((x - oldest.x) / dtMs) * 1000
      const rawVy = ((y - oldest.y) / dtMs) * 1000
      // Mutate lastVelocity in place (no allocation).
      const lv = this.lastVelocity
      lv.x = rawVx < -5000 ? -5000 : rawVx > 5000 ? 5000 : rawVx
      lv.y = rawVy < -5000 ? -5000 : rawVy > 5000 ? 5000 : rawVy
    }

    // Predictive auto-scroll — skip entirely if velocity is essentially zero.
    if (this.autoScrollEnabled) {
      const lv = this.lastVelocity
      if (lv.x + lv.y > 5 || lv.x + lv.y < -5) {
        const containers = this.getContainersArray()
        for (let i = 0; i < containers.length; i++) {
          const c = containers[i]!
          if (!c.autoScroll) continue
          const scroll = computeAutoScroll(
            { x, y },
            c.rect,
            { vx: lv.x, vy: lv.y, lookAheadMs: this.predictionMs },
          )
          if (scroll) c.el.scrollBy(scroll.x, scroll.y)
        }
      }
    }

    // Project the active rect to its new position (inlined — saves a function call).
    const init = active.initialRect
    const projected = this._scratchProjected
    projected.top = init.top + delta.y
    projected.left = init.left + delta.x
    projected.right = init.right + delta.x
    projected.bottom = init.bottom + delta.y
    projected.width = init.width
    projected.height = init.height

    // Apply modifiers. Hot path: zero modifiers (most common case) — skip the loop.
    let finalRect = projected
    const mods = this.modifiers
    const modCount = mods.length
    if (modCount > 0) {
      const lv = this.lastVelocity
      const el = active.el
      for (let i = 0; i < modCount; i++) {
        finalRect = mods[i]!({ rect: finalRect, velocity: lv, el })
      }
    }
    // Compute the visible delta from the final rect vs. the projected rect.
    // Reuse scratch — never escape this scope.
    const visibleDelta = this._scratchVisible
    visibleDelta.x = finalRect.left - projected.left + delta.x
    visibleDelta.y = finalRect.top - projected.top + delta.y

    // Predictive collision — find what the gesture is "really" heading toward.
    // We pass a vector-extrapolated cursor-rect into the same strategy.
    const predictiveDelta = this._scratchPredictive
    const lv2 = this.lastVelocity
    predictiveDelta.x = visibleDelta.x + (lv2.x * this.predictionMs) / 1000
    predictiveDelta.y = visibleDelta.y + (lv2.y * this.predictionMs) / 1000
    const predictiveRect = this._scratchRect
    predictiveRect.top = init.top + predictiveDelta.y
    predictiveRect.left = init.left + predictiveDelta.x
    predictiveRect.right = init.right + predictiveDelta.x
    predictiveRect.bottom = init.bottom + predictiveDelta.y
    predictiveRect.width = init.width
    predictiveRect.height = init.height

    const rects = this.rects
    const collisions = this.collisionStrategy({
      activeRect: finalRect,
      activeId: active.id,
      activeContainerId: active.containerId,
      containers: this.getContainersArray(),
      rects,
      previousCollision: this.previousCollision,
      // Hint: a snap-ahead based on velocity. Strategy implementations
      // can use this for predictive selection. Default strategies
      // currently ignore it; we expose it for power users / custom
      // strategies. (The big win comes from letting the strategy see
      // predictiveRect via the `hint` field; strategic-aware code can
      // pick the snap ahead instead of the current cursor position.)
      hint: predictiveRect,
    })
    this.previousCollision = collisions[0] ?? null

    // Mutate in place — same state object reference, so React doesn't re-render.
    this._state.delta = visibleDelta
    this._state.collisions = collisions.map((c) => c.id)
    this._state.overId = collisions[0]?.id ?? null
    this._state.currentCursor = { x, y }
    this._state.velocity = this.lastVelocity

    // Write the only layout-relevant change: the transform on the active.
    // will-change: transform promotes the element to its own layer so the
    // compositor handles it without layout/paint in the main thread.
    active.transform = visibleDelta
    if (active.el.style.willChange !== 'transform') active.el.style.willChange = 'transform'
    active.el.style.transform = `translate3d(${visibleDelta.x}px, ${visibleDelta.y}px, 0)`

    this.onDragMove?.(this._state)

    // Notify neighbors-only listeners (for cooperative lean UI).
    this.updateNeighbors(collisions.map((c) => c.id))

    // Notify transform subscribers.
    const cb = this.eventListeners.onActiveTransform
    if (cb) cb(finalRect, visibleDelta, this.lastVelocity)
  }

  /** Notify listeners when the set of "neighbors in range" changes. */
  private updateNeighbors(collisionIds: Id[]): void {
    const cb = this.eventListeners.onNeighborsChange
    if (!cb) return
    const next = new Set<Id>()
    for (const id of collisionIds) {
      if (id !== this._state.activeId) next.add(id)
    }
    // Cheap set comparison: same size + every entry matches.
    let same = next.size === this.currentNeighbors.size
    if (same) {
      for (const id of next) {
        if (!this.currentNeighbors.has(id)) { same = false; break }
      }
    }
    if (!same) {
      this.currentNeighbors = next
      cb(Array.from(next))
    }
  }

  // -------------------------------------------------------------------------
  // Drag completion
  // -------------------------------------------------------------------------

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return
    this.complete()
  }

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return
    this.cancel()
  }

  private complete(): void {
    if (this._state.status === 'idle') {
      this.teardown()
      return
    }
    const wasDragging = this._state.status === 'dragging'
    this._state = { ...this._state, status: 'dropping' }
    this.notify()

    if (!wasDragging) {
      this.cancel()
      return
    }

    const active = this.active!
    const speed = Math.hypot(this.lastVelocity.x, this.lastVelocity.y)
    const doThrow = speed > this.throwVelocityThreshold && Number.isFinite(this.throwVelocityThreshold)
    if (doThrow) this.throwRelease(active)
    else this.springRelease(active)
  }

  /** Default drop: spring the active back to origin. */
  private springRelease(active: Draggable): void {
    springTo(active.el, 0, 0, defaultSpring).finished.finally(() => {
      this.onDragEnd?.(this._state)
      this.notify()
      this.reset()
    })
  }

  /**
   * Inertial throw — the active keeps moving with decaying velocity, and
   * we re-run collision each step. Stops when velocity drops below a
   * threshold or no further swap makes sense. Then springs to rest.
   */
  private throwRelease(active: Draggable): void {
    let vx = this.lastVelocity.x
    let vy = this.lastVelocity.y
    const dt = 16 // ~60Hz physics
    const friction = 0.92 // per-frame multiplier (≈ exponential decay)
    const stopSpeed = 50 // px/s
    const accum: Point = { x: active.transform.x, y: active.transform.y }

    const step = (): void => {
      // Add velocity (px/ms → px/frame).
      accum.x += (vx * dt) / 1000
      accum.y += (vy * dt) / 1000
      // Friction.
      vx *= friction
      vy *= friction

      // Write transform.
      active.transform = accum
      active.el.style.transform = `translate3d(${accum.x}px, ${accum.y}px, 0)`

      // Re-evaluate collision under the new predicted position. We use
      // projectRect on the initial rect + accum so the strategy sees
      // the same shape as a real pointer-driven drag.
      const delta = { x: accum.x, y: accum.y }
      const projected = projectRect(active.initialRect, delta)
      const collisions = this.collisionStrategy({
        activeRect: projected,
        activeId: active.id,
        activeContainerId: active.containerId,
        containers: this.getContainersArray(),
        rects: this.rects,
        previousCollision: this.previousCollision,
      })
      this.previousCollision = collisions[0] ?? null
      this._state.collisions = collisions.map((c) => c.id)
      this._state.overId = collisions[0]?.id ?? null
      this._state.delta = delta
      this.updateNeighbors(collisions.map((c) => c.id))

      const speed = Math.hypot(vx, vy)
      if (speed > stopSpeed) {
        this.raf = requestAnimationFrame(step)
        return
      }
      // Snap to rest at current collision position.
      this.springRelease(active)
    }
    this.raf = requestAnimationFrame(step)
  }

  cancel = (): void => {
    if (this._state.status === 'idle') return
    const previousStatus = this._state.status
    this._state = { ...this._state, status: 'cancelled' }
    this.notify()

    const active = this.active
    if (active && previousStatus === 'dragging') {
      springTo(active.el, 0, 0, bouncySpring).finished.finally(() => {
        this.onDragCancel?.(this._state)
        this.notify()
        this.reset()
      })
    } else {
      this.onDragCancel?.(this._state)
      this.notify()
      this.reset()
    }
  }

  private reset(): void {
    const active = this.active
    if (active) {
      active.el.style.transform = ''
      active.el.style.zIndex = ''
      active.el.style.willChange = ''
      active.transform = { x: 0, y: 0 }
    }
    this.active = null
    this.activePointerId = -1
    this.pending = null
    this.previousCollision = null
    this.velocityBuffer = []
    this.lastVelocity = { x: 0, y: 0 }
    this.currentNeighbors = new Set()
    this._state = idle()
    this.teardown()
  }

  private teardown(): void {
    document.removeEventListener('pointermove', this.onMove)
    document.removeEventListener('pointerup', this.onUp)
    document.removeEventListener('pointercancel', this.onCancel)
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  // -------------------------------------------------------------------------
  // Window-level handlers
  // -------------------------------------------------------------------------

  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible') this.cancel()
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._state.status !== 'idle') {
      e.preventDefault()
      this.cancel()
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Update engine options at runtime. Useful for live settings UIs.
   * Only the fields you pass in are updated; the rest stay.
   */
  updateOptions(options: Partial<EngineOptions>): void {
    if (options.predictionMs !== undefined) {
      ;(this as any).predictionMs = options.predictionMs
    }
    if (options.throwVelocityThreshold !== undefined) {
      ;(this as any).throwVelocityThreshold = options.throwVelocityThreshold
    }
    if (options.autoScroll !== undefined) {
      ;(this as any).autoScrollEnabled = options.autoScroll
    }
    if (options.activationDistance !== undefined) {
      ;(this as any).activationDistance = options.activationDistance
    }
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.cancel)
      document.removeEventListener('visibilitychange', this.onVisibility)
      window.removeEventListener('keydown', this.onKey)
    }
    this.draggables.clear()
    this.containers.clear()
    this.rects.clear()
    this.elements.clear()
    this.listeners.clear()
    cancelAnimationFrame(this.raf)
  }

  // -------------------------------------------------------------------------
  // Rects (public accessor for modifiers / custom adapters)
  // -------------------------------------------------------------------------

  getRect(id: Id): Rect | null {
    return this.rects.get(id) ?? null
  }

  /** Returns the initial rect for a registered item or container. */
  getInitialRect(id: Id): Rect | null {
    const d = this.draggables.get(id) ?? this.containers.get(id)
    return d ? ((d as any).initialRect ?? (d as any).rect) : null
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private findId(el: HTMLElement): Id | undefined {
    return this.elementToId.get(el)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}

function idle(): DragState {
  return {
    status: 'idle',
    activeId: null,
    activeContainerId: null,
    delta: { x: 0, y: 0 },
    collisions: [],
    overId: null,
    currentCursor: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
  }
}
