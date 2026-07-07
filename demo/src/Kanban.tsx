import { useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenterStrategy } from 'kinetik'

type Card = { id: string; title: string }

const initial: Record<string, Card[]> = {
  todo: [
    { id: 'k1', title: 'Design empty states' },
    { id: 'k2', title: 'Audit accessibility on /settings' },
    { id: 'k3', title: 'Spike: WebSocket reconnection' },
  ],
  doing: [
    { id: 'k4', title: 'Refactor drag-and-drop internals' },
    { id: 'k5', title: 'Profile the dashboard render path' },
  ],
  done: [
    { id: 'k6', title: 'Ship dark mode toggle' },
    { id: 'k7', title: 'Fix flaky CI test' },
    { id: 'k8', title: 'Update onboarding copy' },
  ],
}

const columnTitles: Record<string, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
}

export function Kanban(): JSX.Element {
  const [columns, setColumns] = useState(initial)
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <DndContext
      collisionStrategy={closestCenterStrategy}
      onDragStart={(id) => setActiveId(String(id))}
      onDragEnd={({ active, over }) => {
        if (over == null) {
          setActiveId(null)
          return
        }
        const aId = String(active)
        const oId = String(over)
        setColumns((prev) => {
          const next = { ...prev }
          const sourceCol = findColumn(prev, aId)
          const targetCol = findColumn(prev, oId)
          if (!sourceCol || !targetCol) return prev
          const card = prev[sourceCol]!.find((c) => c.id === aId)!
          if (sourceCol === targetCol) {
            const items = next[sourceCol]!.filter((c) => c.id !== aId)
            const overIndex = items.findIndex((c) => c.id === oId)
            items.splice(overIndex >= 0 ? overIndex + 1 : items.length, 0, card)
            next[sourceCol] = items
          } else {
            const sourceItems = next[sourceCol]!.filter((c) => c.id !== aId)
            const targetItems = next[targetCol]!.slice()
            const overIndex = targetItems.findIndex((c) => c.id === oId)
            targetItems.splice(overIndex >= 0 ? overIndex + 1 : targetItems.length, 0, card)
            next[sourceCol] = sourceItems
            next[targetCol] = targetItems
          }
          return next
        })
        setActiveId(null)
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="kanban">
        {Object.entries(columns).map(([colId, cards]) => (
          <Column key={colId} id={colId} title={columnTitles[colId]!} cards={cards} />
        ))}
      </div>
      <DragOverlay>
        {activeId != null ? (
          <div className="card">{findCard(columns, activeId)?.title ?? ''}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({ id, title, cards }: { id: string; title: string; cards: Card[] }) {
  const { setNodeRef } = useDroppable({ id, items: cards.map((c) => c.id) })
  return (
    <div ref={setNodeRef} className="column" data-column-id={id}>
      <div className="column-header">{title}</div>
      {cards.map((card) => <CardItem key={card.id} card={card} columnId={id} />)}
    </div>
  )
}

function CardItem({ card, columnId }: { card: Card; columnId: string }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: card.id, containerId: columnId })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="card"
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: 'none', cursor: 'grab' }}
    >
      {card.title}
    </div>
  )
}

function findColumn(columns: Record<string, Card[]>, cardId: string): string | null {
  for (const [col, cards] of Object.entries(columns)) {
    if (cards.some((c) => c.id === cardId)) return col
  }
  return null
}

function findCard(columns: Record<string, Card[]>, cardId: string): Card | null {
  for (const cards of Object.values(columns)) {
    const found = cards.find((c) => c.id === cardId)
    if (found) return found
  }
  return null
}
