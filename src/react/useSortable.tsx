/**
 * useSortable — register a sortable item.
 *
 * Use with `useSortableContainer` to declare the parent list:
 *
 *   function MyList({ items }) {
 *     const { setNodeRef } = useSortableContainer('list', items)
 *     return <ul ref={setNodeRef}>
 *       {items.map(id => <SortableItem key={id} id={id} />)}
 *     </ul>
 *   }
 *
 *   function SortableItem({ id }) {
 *     const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id })
 *     return <li ref={setNodeRef} {...attributes} {...listeners}>...</li>
 *   }
 */

import { useCallback, useEffect, useRef, useContext, type CSSProperties, type ReactNode } from 'react'
import { useEngine, useDragState } from './DndContext.js'
import { ContainerProvider, useNearestContainerId } from './ContainerContext.js'
import { useKeyboardSensor } from './useKeyboardSensor.js'
import { captureFlip } from '../core/animator.js'
import type { Id } from '../core/types.js'

/** Hook for the container element of a sortable list. Pass the current items. */
export function useSortableContainer<T extends Id = Id>(id: Id, items: T[]) {
  const engine = useEngine()
  const ref = useRef<HTMLElement | null>(null)
  const itemsRef = useRef<Id[]>(items)
  itemsRef.current = items

  // Register the container element on mount.
  useEffect(() => {
    if (!ref.current) return
    engine.registerContainer(id, ref.current, itemsRef.current)
    return () => engine.unregisterContainer(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, id])

  // Keep orderedChildren in sync with the items array.
  useEffect(() => {
    engine.updateContainer(id, items)
  }, [engine, id, items])

  // Wrap children in a ContainerProvider so useSortable items can read
  // the container id directly via context (better for virtualized lists).
  return {
    setNodeRef: (el: HTMLElement | null) => {
      ref.current = el
      if (el) engine.registerContainer(id, el, items)
    },
    ContainerProvider,
    containerId: id,
  }
}

// Convenience: a component that registers a container AND provides context
// to children. Use when your items are React components (not virtualized).
export function SortableContext({
  id,
  items,
  children,
}: {
  id: Id
  items: Id[]
  children: ReactNode
}): JSX.Element {
  const { setNodeRef, containerId } = useSortableContainer(id, items)
  return (
    <div ref={setNodeRef as any} data-container-id={String(id)} style={{ display: 'contents' }}>
      <ContainerProvider value={containerId}>{children}</ContainerProvider>
    </div>
  )
}

export interface UseSortableOptions<T extends Id = Id> {
  /** The item's id, must be one of the items passed to useSortableContainer. */
  id: T
  disabled?: boolean
  /** Container this item belongs to. Optional — inferred from parent if not set. */
  containerId?: Id
}

export interface UseSortableReturn {
  setNodeRef: (node: HTMLElement | null) => void
  attributes: Record<string, unknown>
  listeners: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void }
  isDragging: boolean
  style: CSSProperties
}

export function useSortable<T extends Id = Id>({ id, disabled, containerId }: UseSortableOptions<T>): UseSortableReturn {
  const engine = useEngine()
  const state = useDragState()
  const elRef = useRef<HTMLElement | null>(null)
  // Keyboard sensor — attached when this hook is mounted. Listens for Space,
  // Enter, Arrow keys, and Escape on the document. Requires the element to be
  // focusable (we set tabIndex in attributes below).
  useKeyboardSensor({ id, disabled })

  // FLIP on drop. Only the active item runs it.
  const flipRanFor = useRef<Id | null>(null)
  useEffect(() => {
    if (state.status !== 'dropping' || state.activeId !== id) return
    if (flipRanFor.current === id) return
    flipRanFor.current = id
    requestAnimationFrame(() => {
      const el = elRef.current?.parentElement
      if (!el) return
      captureFlip(Array.from(el.children) as HTMLElement[]).play()
    })
  }, [state.status, state.activeId, id])

  // Register with the engine on mount.
  const ctxContainerId = useNearestContainerId()
  useEffect(() => {
    if (!elRef.current) return
    // Container id resolution order:
    // 1. explicit `containerId` prop (highest priority)
    // 2. ContainerContext (provided by useSortableContainer or SortableContext)
    // 3. DOM walk to find a registered ancestor (covers non-virtualized use)
    const cId = containerId ?? ctxContainerId ?? engine.findContainerId(elRef.current) ?? null
    engine.registerDraggable(id, elRef.current, cId, !!disabled)
    return () => engine.unregisterDraggable(id)
  }, [engine, id, containerId, ctxContainerId, disabled])

  const setNodeRef = useCallback(
    (el: HTMLElement | null) => {
      elRef.current = el
      if (el) engine.updateDraggable(id, el)
    },
    [engine, id],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return
      engine.beginDrag(id, e.nativeEvent)
    },
    [engine, id, disabled],
  )

  const isDragging = state.activeId === id && state.status === 'dragging'

  return {
    setNodeRef,
    attributes: {
      'data-sortable-id': id,
      'aria-roledescription': 'sortable item',
      tabIndex: disabled ? -1 : 0,
      role: 'listitem',
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
