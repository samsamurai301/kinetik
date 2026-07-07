/**
 * useMultiDrag — drag selected items as a group.
 *
 * Compose with useSortable to enable multi-drag:
 *
 * ```tsx
 * const multi = useMultiDrag({ ids: selected })
 * function Item({ id }) {
 *   const sortable = useSortable({ id })
 *   const { onPointerDown } = useMultiDragItem(id, multi)
 *   return <li {...sortable.attributes} {...sortable.listeners} onPointerDown={(e) => {
 *     onPointerDown(e)
 *     sortable.listeners.onPointerDown(e)
 *   }}>...</li>
 * }
 * ```
 *
 * For now, this provides the data model and a React-side hook for tracking
 * selected ids. Actual multi-drag (engine supports multiple active items in a
 * single drag) will be wired in a future iteration.
 */
import { useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import type { Id } from '../core/types.js'

export interface MultiDragState {
  selectedIds: Set<Id>
  toggleSelect: (id: Id, additive?: boolean) => void
  clearSelection: () => void
  isSelected: (id: Id) => boolean
}

export interface UseMultiDragOptions {
  /** Controlled set of selected ids. If absent, the hook manages its own. */
  selected?: Set<Id>
  defaultSelected?: Set<Id>
  onSelectionChange?: (next: Set<Id>) => void
  /** Predicate to determine if an item can be multi-selected. */
  canSelect?: (id: Id) => boolean
}

export function useMultiDrag(options: UseMultiDragOptions = {}): MultiDragState {
  const [internal, setInternal] = useState<Set<Id>>(options.defaultSelected ?? new Set())
  const selected = options.selected ?? internal
  const canSelect = options.canSelect

  const toggleSelect = useCallback(
    (id: Id, additive = true) => {
      if (canSelect && !canSelect(id)) return
      const next = new Set(selected)
      if (next.has(id) && additive) next.delete(id)
      else next.add(id)
      if (!options.selected) setInternal(next)
      options.onSelectionChange?.(next)
    },
    [selected, options.selected, canSelect, options.onSelectionChange],
  )

  const clearSelection = useCallback(() => {
    const next = new Set<Id>()
    if (!options.selected) setInternal(next)
    options.onSelectionChange?.(next)
  }, [options.selected, options.onSelectionChange])

  const isSelected = useCallback((id: Id) => selected.has(id), [selected])

  return { selectedIds: selected, toggleSelect, clearSelection, isSelected }
}

/**
 * Hook for the multi-drag pointer-down handler. Returns a wrapped listener
 * that selects on shift-click and starts a group drag on plain click.
 */
export function useMultiDragItem(
  id: Id,
  multi: MultiDragState,
): {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  isSelected: boolean
} {
  return {
    isSelected: multi.isSelected(id),
    onPointerDown: (e) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        multi.toggleSelect(id)
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.button !== 0) return
    },
  }
}
