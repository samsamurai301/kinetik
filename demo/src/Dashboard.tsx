/**
 * Dashboard — resizable widget grid. Demonstrates the free-form drag
 * (useDraggable + useDroppable) — no implicit reordering, the user has full
 * control over where each widget ends up via explicit drop zones.
 */
import { useState } from 'react'
import { DndContext, useDraggable, useDroppable, DragOverlay } from 'kinetik'

interface Widget {
  id: string
  title: string
  body: string
  row: number
  col: number
}

const INITIAL: Widget[] = [
  { id: 'w1', title: 'Revenue', body: '$124,500 this week', row: 0, col: 0 },
  { id: 'w2', title: 'New users', body: '832 signups', row: 0, col: 1 },
  { id: 'w3', title: 'Top issue', body: '"crash on import"', row: 1, col: 0 },
  { id: 'w4', title: 'Velocity', body: '47 pts / sprint', row: 1, col: 1 },
]

const COLS = 3
const ROWS = 2

function WidgetCard({ widget }: { widget: Widget }) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useDraggable({ id: widget.id })
  return (
    <div
      ref={setNodeRef}
      className={`widget ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <h4>{widget.title}</h4>
      <p>{widget.body}</p>
    </div>
  )
}

function Cell({ row, col }: { row: number; col: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${row}-${col}` })
  return (
    <div ref={setNodeRef} className={`cell ${isOver ? 'is-over' : ''}`} data-row={row} data-col={col} />
  )
}

export function Dashboard() {
  const [widgets, setWidgets] = useState<Widget[]>(INITIAL)
  const [activeId, setActiveId] = useState<string | null>(null)

  const handleDragStart = (id: string) => setActiveId(id)
  const handleDragEnd = (e: { active: { id: string }; over: { id: string } | null }) => {
    setActiveId(null)
    if (!e.over || !e.over.id.startsWith('cell-')) return
    const [row, col] = e.over.id.slice(5).split('-').map(Number)
    setWidgets((ws) => ws.map((w) => (w.id === e.active.id ? { ...w, row: row!, col: col! } : w)))
  }

  return (
    <DndContext
      onDragStart={({ active }) => handleDragStart(String(active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="dashboard-demo">
        <h3>Dashboard — drag widgets to cells</h3>
        <div className="dashboard-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 120px)` }}>
          {Array.from({ length: ROWS }).flatMap((_, row) =>
            Array.from({ length: COLS }).map((_, col) => (
              <Cell key={`${row}-${col}`} row={row} col={col} />
            )),
          )}
          {widgets.map((w) => (
            <div
              key={w.id}
              className="widget-slot"
              style={{
                gridRow: w.row + 1,
                gridColumn: w.col + 1,
              }}
            >
              <WidgetCard widget={w} />
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeId ? (() => {
            const w = widgets.find((x) => x.id === activeId)
            return w ? <div className="widget overlay"><h4>{w.title}</h4><p>{w.body}</p></div> : null
          })() : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
