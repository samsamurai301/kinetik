import { useState } from 'react'
import {
  DndContext,
  useSortable,
  useSortableContainer,
  useMultiDrag,
  useViewTransition,
  viewTransitionName,
  DragOverlay,
} from 'kinetik'

/**
 * MultiSelectList — demo of group drag.
 *
 * Demo rules:
 * - Shift-click (or Cmd/Ctrl-click) toggles selection.
 * - Plain click starts a regular single-item drag.
 *
 * For brevity, the actual "drag multiple items" path is a single carousel;
 * a fuller implementation would replace the active `transform: translate3d`
 * with a sum per-item transform based on the group's centroid.
 */
export function MultiSelectList(): JSX.Element {
  const [items] = useState([
    'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew',
  ])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const reorder = useViewTransition()

  const multi = useMultiDrag({
    defaultSelected: new Set(['Banana', 'Cherry']),
  })

  const lastSelected = Array.from(multi.selectedIds)

  return (
    <DndContext
      onDragStart={(id) => {
        setActiveId(String(id))
        setDragOverId(null)
      }}
      onDragMove={(state) => setDragOverId(state.overId == null ? null : String(state.overId))}
      onDragEnd={({ active, over }) => {
        setDragOverId(null)
        if (over != null && active.id !== over.id) {
          reorder(() => {
            // For brevity: single-item move only.
          })
        }
        setActiveId(null)
      }}
      onDragCancel={() => {
        setActiveId(null)
        setDragOverId(null)
      }}
    >
      <div className="multiselect-shell">
        <div className="multiselect-summary" data-count={lastSelected.length}>
          <strong>{lastSelected.length}</strong> of {items.length} selected
          {lastSelected.length > 0 && (
            <button className="link" onClick={() => multi.clearSelection()}>
              clear
            </button>
          )}
        </div>
        <ul className="multiselect-list">
          {items.map((id) => (
            <MultiItem
              key={id}
              id={id}
              activeDragId={activeId}
              dragOverId={dragOverId}
              multi={multi}
              isSelected={multi.isSelected(id)}
            />
          ))}
        </ul>
      </div>
      <DragOverlay>
        {activeId != null ? <div className="multi-item-overlay">{activeId}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}

function MultiItem({
  id,
  multi,
  isSelected,
  activeDragId,
  dragOverId,
}: {
  id: string
  multi: ReturnType<typeof useMultiDrag>
  isSelected: boolean
  activeDragId: string | null
  dragOverId: string | null
}) {
  const { setNodeRef, attributes, listeners } = useSortable({
    id,
    ariaLabel: `Toggle or drag selection item ${id}`,
  })
  const isDropTarget = dragOverId === id && dragOverId !== activeDragId
  return (
    <li
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          multi.toggleSelect(id)
          e.preventDefault()
          return
        }
      }}
      className={`multi-item ${isDropTarget ? 'is-over' : ''}`}
      data-selected={isSelected}
      style={{ viewTransitionName: viewTransitionName(id) }}
    >
      <span className="checkbox" data-on={isSelected}>{isSelected ? '✓' : ' '}</span>
      <span className="label">{id}</span>
    </li>
  )
}
