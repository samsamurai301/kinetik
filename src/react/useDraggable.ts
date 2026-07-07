/**
 * useDraggable — register a node as draggable. Lower-level than useSortable;
 * use this for free-form drag (no reorder, no auto collision).
 *
 *   const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id })
 *   return <div ref={setNodeRef} {...attributes} {...listeners}>...</div>
 */

import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useEngine, useDragState } from './DndContext.js'
import { useKeyboardSensor } from './useKeyboardSensor.js'
import type { Id } from '../core/types.js'

export interface UseDraggableOptions<T extends Id = Id> {
  id: T
  disabled?: boolean
  containerId?: Id | null
}

export interface UseDraggableReturn {
  setNodeRef: (el: HTMLElement | null) => void
  attributes: Record<string, unknown>
  listeners: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void }
  isDragging: boolean
  style: CSSProperties
}

export function useDraggable<T extends Id = Id>({ id, disabled, containerId = null }: UseDraggableOptions<T>): UseDraggableReturn {
  const engine = useEngine()
  const state = useDragState()
  const elRef = useRef<HTMLElement | null>(null)
  // Pick up / move / drop via keyboard (Space + arrows + Escape).
  useKeyboardSensor({ id, disabled })

  useEffect(() => {
    if (!elRef.current) return
    engine.registerDraggable(id, elRef.current, containerId, !!disabled)
    return () => engine.unregisterDraggable(id)
  }, [engine, id, containerId, disabled])

  const setNodeRef = useCallback(
    (el: HTMLElement | null) => {
      elRef.current = el
      if (el) engine.registerDraggable(id, el, containerId, !!disabled)
    },
    [engine, id, containerId, disabled],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return
      engine.beginDrag(id, e.nativeEvent)
    },
    [engine, id, disabled],
  )

  const isDragging = state.activeId === id && state.status !== 'idle'

  return {
    setNodeRef,
    attributes: {
      'data-draggable-id': id,
      tabIndex: disabled ? -1 : 0,
      role: 'button',
    },
    listeners: { onPointerDown },
    isDragging,
    style: {
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      cursor: disabled ? 'default' : 'grab',
      ...(isDragging ? { opacity: 0.3, pointerEvents: 'none' as const } : {}),
    },
  }
}
