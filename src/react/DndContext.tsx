/**
 * DndContext — the React boundary for drag-and-drop.
 *
 * Uses `useSyncExternalStore` so React subscribes to the engine without us
 * writing a manual subscription effect. The engine mutates state in place
 * during drag frames (no React renders), and we replace the state reference
 * only on lifecycle transitions (idle → pending → dragging → dropping).
 *
 * The engine is created exactly once per provider mount and torn down on
 * unmount. Listeners attached by hooks register on mount and unregister on
 * unmount.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { DragEngine, type EngineOptions } from '../core/engine.js'
import type { Id } from '../core/types.js'
import type { DragState } from '../core/types.js'
import type { Modifier } from '../modifiers/index.js'

/** Public result of a drag. */
export interface DragEndEvent {
  active: { id: Id }
  /** The top collision. For action droppables, this will be the action key. */
  over: { id: Id } | null
  /** Optional parsed action payload when `over.id` is encoded as `action:<action-id>`. */
  overAction?: { id: string }
}

export type DragEndEventLegacy = (activeId: Id, overId: Id | null) => void
export type DragEndEventHandler = ((event: DragEndEvent) => void) | DragEndEventLegacy

export interface DndContextProps {
  children: ReactNode
  onDragStart?: (id: Id) => void
  onDragEnd?: DragEndEventHandler
  onDragCancel?: (id: Id) => void
  onDragMove?: (state: DragState) => void
  /** Engine tuning. Sensible defaults for almost everyone. */
  activationDistance?: number
  autoScroll?: boolean
  /** Use a custom collision strategy. Default: `sortableStrategy`. */
  collisionStrategy?: EngineOptions['collisionStrategy']
  /** Transform-only post-processors (composed left-to-right). */
  modifiers?: Modifier[]
  /** Look-ahead time for predictive collision (ms). Default 60. */
  predictionMs?: number
  /** Pointer velocity (px/s) above which a release triggers a throw. Default 700. */
  throwVelocityThreshold?: number
}

const EngineContext = createContext<DragEngine | null>(null)

/**
 * Provide a drag engine to children. Wrap your app once. Multiple providers
 * can coexist for independent drag regions (each gets its own engine).
 */
export function DndContext({ children, onDragStart, onDragEnd, onDragCancel, onDragMove, ...rest }: DndContextProps) {
  // Refs for the latest callbacks so the engine (created once) sees them.
  const startRef = useRef(onDragStart)
  const endRef = useRef(onDragEnd)
  const cancelRef = useRef(onDragCancel)
  const moveRef = useRef(onDragMove)
  startRef.current = onDragStart
  endRef.current = onDragEnd
  cancelRef.current = onDragCancel
  moveRef.current = onDragMove

  const optsRef = useRef(rest)
  optsRef.current = rest

  const emitDragEnd = (state: { activeId: Id | null; overId: Id | null }) => {
    const cb = endRef.current
    if (!cb) return
    const activeId = state.activeId
    if (activeId == null) return
    const payload: DragEndEvent = {
      active: { id: activeId },
      over: state.overId == null ? null : { id: state.overId },
      overAction: parseOverAction(state.overId),
    }
    if (cb.length >= 2) {
      ;(cb as DragEndEventLegacy)(activeId, state.overId)
      return
    }
    ;(cb as (event: DragEndEvent) => void)(payload)
  }

  const engine = useMemo(
    () =>
      new DragEngine({
        ...rest,
        get activationDistance() { return optsRef.current.activationDistance ?? 4 },
        get autoScroll() { return optsRef.current.autoScroll ?? true },
        get collisionStrategy() { return optsRef.current.collisionStrategy },
        onDragStart: (id) => startRef.current?.(id),
        onDragEnd: (s) => emitDragEnd(s),
        onDragMove: (s) => moveRef.current?.(s),
        onDragCancel: (s) => cancelRef.current?.(s.activeId!),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => () => engine.destroy(), [engine])

  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
}

/** Read the engine from the surrounding DndContext. Throws if used outside. */
export function useEngine(): DragEngine {
  const e = useContext(EngineContext)
  if (!e) {
    throw new Error(
      '[kinetik] useEngine() / useSortable() / useDraggable() / useDroppable() must be ' +
      'called inside a <DndContext>. Wrap your component tree with it, e.g.:\n\n' +
      '  <DndContext>\n' +
      '    <YourList />\n' +
      '  </DndContext>\n\n' +
      'See https://kinetik.dev/docs/setup for the full setup.',
    )
  }
  return e
}

/** Subscribe to drag state with React 18's blessed pattern. No re-renders mid-frame. */
export function useDragState() {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, engine.getState, engine.getState)
}

function parseOverAction(overId: Id | null): { id: string } | undefined {
  if (overId == null) return undefined
  const asString = String(overId)
  if (!asString.startsWith('action:')) return undefined
  const action = asString.slice('action:'.length).trim()
  if (!action) return undefined
  return { id: action }
}
