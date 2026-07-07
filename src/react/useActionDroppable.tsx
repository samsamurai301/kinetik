/**
 * useActionDroppable — a droppable with semantic meaning.
 *
 * Unlike `useDroppable` which models "where to drop *a* thing", an action
 * droppable models "drop here to *do X*". Each action has a different
 * preview, hover color, and onDragEnd routing.
 *
 * Built-in actions:
 * - 'delete'  — destructive, red hover, releases the active item from its container
 * - 'archive' — neutral, archives to a side lane
 * - 'duplicate' — adds a copy under the active item
 *
 * Or pass your own action.
 *
 * ```tsx
 * <DndContext
 *   onDragEnd={({ active, overAction }) => {
 *     if (overAction?.id === 'delete') deleteItem(active)
 *   }}
 * >
 *   <List />
 *   <DeleteZone /> // <ActionDroppable action="delete" />
 * </DndContext>
 * ```
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEngine, useDragState } from './DndContext.js'
import type { Id } from '../core/types.js'

export type DropActionKind = 'delete' | 'archive' | 'duplicate' | 'custom'

export interface UseActionDroppableOptions {
  /** The action this droppable represents. */
  action: DropActionKind | string
  /** Optional human-readable label. */
  label?: string
  /** Whether the droppable is disabled. */
  disabled?: boolean
}

export interface UseActionDroppableReturn {
  setNodeRef: (el: HTMLElement | null) => void
  isOver: boolean
  /** The action id, exposed for routing in onDragEnd. */
  action: string
  /** Recommended overlay color when hovered. */
  hoverColor: string
}

const ACTION_COLORS: Record<string, string> = {
  delete: 'rgba(255, 80, 80, 0.18)',
  archive: 'rgba(140, 140, 140, 0.18)',
  duplicate: 'rgba(80, 200, 120, 0.18)',
}

export function useActionDroppable(options: UseActionDroppableOptions): UseActionDroppableReturn {
  const engine = useEngine()
  const state = useDragState()
  const ref = useRef<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)
  const optsRef = useRef(options)
  optsRef.current = options

  const setNodeRef = useCallback(
    (el: HTMLElement | null) => {
      ref.current = el
      if (!el) return
    },
    [],
  )

  useEffect(() => {
    const el = ref.current
    if (!el || options.disabled) return
    const id = `action:${options.action}`
    // Register as a container so collision strategies can detect it.
    engine.registerContainer(id, el, [], true, !!options.disabled)
    return () => engine.unregisterContainer(id)
  }, [engine, options.action, options.disabled])

  // Detect when we're the active's overId (via state mutation).
  const overId = state.overId
  useEffect(() => {
    const id = `action:${options.action}`
    setIsOver(overId === id && state.status === 'dragging')
  }, [overId, state.status, options.action])

  return {
    setNodeRef,
    isOver,
    action: options.action,
    hoverColor: ACTION_COLORS[options.action] ?? ACTION_COLORS.delete!,
  }
}
