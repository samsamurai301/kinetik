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
  const reorder = useViewTransition()

  const onDragEnd = ({ active, over }: { active: string | number; over: string | number | null }) => {
    setActiveId(null)
    if (over != null && active !== over) {
      reorder(() => {
        setItems((prev) => arrayMove(prev, String(active), String(over)))
      })
    }
  }

  return (
    <DndContext
      modifiers={[restrictToVerticalAxis]}
      onDragStart={(id) => setActiveId(String(id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <List items={items} />
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

function List({ items }: { items: string[] }) {
  const { setNodeRef } = useSortableContainer('list', items)
  return (
    <ul ref={setNodeRef as any} className="list" data-container-id="list">
      {items.map((text) => (
        <Item key={text} id={text} />
      ))}
    </ul>
  )
}

function Item({ id }: { id: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      className="list-item"
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
