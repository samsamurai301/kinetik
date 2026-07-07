/**
 * useDroppable — register a node as a drop target. Lower-level than useSortable;
 * use for kanban-style multi-container drops where you need to know which
 * container was hovered.
 */

import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useEngine, useDragState } from './DndContext.js'
import type { Id } from '../core/types.js'

export interface UseDroppableOptions {
  id: Id
  disabled?: boolean
  /** Items in render order. Required for sortable-style strategies. */
  items?: Id[]
  autoScroll?: boolean
}

export interface UseDroppableReturn {
  setNodeRef: (el: HTMLElement | null) => void
  isOver: boolean
  style: CSSProperties
  attributes: Record<string, unknown>
}

export function useDroppable({ id, disabled, items = [], autoScroll = true }: UseDroppableOptions): UseDroppableReturn {
  const engine = useEngine()
  const state = useDragState()
  const elRef = useRef<HTMLElement | null>(null)
  const itemsRef = useRef<Id[]>(items)
  itemsRef.current = items

  useEffect(() => {
    if (!elRef.current) return
    engine.registerContainer(id, elRef.current, itemsRef.current, autoScroll, !!disabled)
    return () => engine.unregisterContainer(id)
  }, [engine, id, disabled, autoScroll])

  useEffect(() => {
    engine.updateContainer(id, items)
  }, [engine, id, items])

  const setNodeRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el
    if (el) engine.registerContainer(id, el, itemsRef.current, autoScroll, !!disabled)
  }, [engine, id, disabled, autoScroll])

  const isOver = state.overId === id && state.status === 'dragging'

  return {
    setNodeRef,
    isOver,
    style: isOver ? { outline: '2px dashed currentColor', outlineOffset: '-2px' } : {},
    attributes: { 'data-droppable-id': id },
  }
}
