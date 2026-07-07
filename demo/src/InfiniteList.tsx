/**
 * InfiniteList — a virtualized-looking list that lazily adds items as you
 * drag toward the end. Demonstrates dynamic item registration mid-drag.
 */
import { useState, useRef } from 'react'
import { DndContext, useSortable, useSortableContainer } from 'kinetik'

const INITIAL = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`)

function Row({ id, label }: { id: string; label: string }) {
  const { setNodeRef, attributes, listeners, style, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`row ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      {label}
    </div>
  )
}

export function InfiniteList() {
  const [items, setItems] = useState<string[]>(INITIAL)
  const nextId = useRef(items.length + 1)

  const loadMore = (currentItems: string[]): string[] => {
    const next: string[] = []
    for (let i = 0; i < 10; i++) {
      next.push(`Item ${nextId.current++}`)
    }
    return [...currentItems, ...next]
  }

  const handleDragEnd = ({ active, over }: { active: { id: string }; over: { id: string } | null }) => {
    if (!over || active.id === over.id) return
    const oldIndex = items.indexOf(active.id)
    const newIndex = items.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = [...items]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved!)
    // If user dragged near the end, auto-load more.
    setItems(newIndex >= reordered.length - 3 ? loadMore(reordered) : reordered)
  }

  const { setNodeRef } = useSortableContainer('infinite', items)
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="infinite-list-demo">
        <h3>Infinite list — drag toward the end to load more</h3>
        <div ref={setNodeRef} className="infinite-list">
          {items.map((label) => <Row key={label} id={label} label={label} />)}
        </div>
        <p className="hint">{items.length} items</p>
      </div>
    </DndContext>
  )
}
