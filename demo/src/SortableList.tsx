import { useState } from 'react'
import {
  DndContext,
  useSortable,
  useSortableContainer,
  useViewTransition,
  viewTransitionName,
  restrictToVerticalAxis,
  DragOverlay,
} from 'kinetik'

interface Props {
  items: string[]
}

/**
 * SortableList — single container, reorder on drop.
 *
 * Demonstrates:
 * - Minimal hook surface: useSortableContainer + useSortable
 * - DragOverlay as floating preview
 * - View Transitions API for free reorder animation (where supported)
 * - restrictToVerticalAxis modifier
 */
export function SortableList({ items: initial }: Props): JSX.Element {
  const [items, setItems] = useState(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const reorder = useViewTransition()

  const onDragEnd = ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => {
    setActiveId(null)
    setDragOverId(null)
    if (over != null && active.id !== over.id) {
      reorder(() => {
        setItems((prev) => arrayMove(prev, String(active.id), String(over.id)))
      })
    }
  }

  return (
    <DndContext
      modifiers={[restrictToVerticalAxis]}
      onDragStart={(id) => {
        setActiveId(String(id))
        setDragOverId(null)
      }}
      onDragMove={(state) => setDragOverId(state.overId == null ? null : String(state.overId))}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragOverId(null)
      }}
    >
      <List items={items} activeDragId={activeId} dragOverId={dragOverId} />
      <DragOverlay>
        {activeId != null ? (
          <div className="list-item">
            <span className="handle" aria-hidden>⋮⋮</span>
            <span className="title">{activeId}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function List({ items, activeDragId, dragOverId }: { items: string[]; activeDragId: string | null; dragOverId: string | null }) {
  const { setNodeRef } = useSortableContainer('list', items)
  return (
    <ul ref={setNodeRef as any} className="list" data-container-id="list">
      {items.map((text) => (
        <Item key={text} id={text} activeDragId={activeDragId} dragOverId={dragOverId} />
      ))}
    </ul>
  )
}

function Item({ id, activeDragId, dragOverId }: { id: string; activeDragId: string | null; dragOverId: string | null }) {
  const { setNodeRef, listeners, attributes, isDragging } = useSortable({
    id,
    ariaLabel: `Move task: ${id}`,
  })
  const isDropTarget = dragOverId === id && dragOverId !== activeDragId
  return (
    <li
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      className={`list-item ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-over' : ''}`}
      data-vt-name={viewTransitionName(id)}
      style={{
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      <span className="handle" aria-hidden>⋮⋮</span>
      <span className="title">{id}</span>
    </li>
  )
}

function arrayMove<T>(array: T[], from: T, to: T): T[] {
  const fromIndex = array.indexOf(from)
  const toIndex = array.indexOf(to)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return array
  const result = array.slice()
  const [removed] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, removed!)
  return result
}
