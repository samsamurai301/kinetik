import { useState } from 'react'
import {
  CollisionStrategy,
  DndContext,
  DragOverlay,
  Rect,
  closestCenterStrategy,
  rectIntersectionStrategy,
  useDraggable,
  useDroppable,
  useEngine,
} from 'kinetik'

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
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragCursor, setDragCursor] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  return (
    <DndContext
      collisionStrategy={kanbanCollisionStrategy}
      onDragStart={(id) => {
        setActiveId(String(id))
        setIsDragging(true)
      }}
      onDragMove={(state) => {
        setDragOverId(state.overId == null ? null : String(state.overId))
        setDragCursor(state.currentCursor)
      }}
      onDragEnd={({ active, over }) => {
        const aId = String(active.id)
        if (over == null) {
          setActiveId(null)
          setDragOverId(null)
          setIsDragging(false)
          return
        }
        setColumns((prev) => {
          const next = { ...prev }
          const sourceCol = findColumn(prev, aId)
          if (!sourceCol) return prev
          const card = prev[sourceCol]!.find((c) => c.id === aId)
          if (!card) return prev
          const targetCol = resolveTargetColumn(prev, String(over.id))
          if (!targetCol) return prev
          if (sourceCol === targetCol) {
            const items = next[sourceCol]!.filter((c) => c.id !== aId)
            const overIndex = items.findIndex((c) => c.id === String(over.id))
            items.splice(overIndex >= 0 ? overIndex + 1 : items.length, 0, card)
            next[sourceCol] = items
          } else {
            const sourceItems = next[sourceCol]!.filter((c) => c.id !== aId)
            const targetItems = next[targetCol]!.slice()
            const overIndex = targetItems.findIndex((c) => c.id === String(over.id))
            targetItems.splice(overIndex >= 0 ? overIndex + 1 : targetItems.length, 0, card)
            next[sourceCol] = sourceItems
            next[targetCol] = targetItems
          }
          return next
        })
        setActiveId(null)
        setDragOverId(null)
        setIsDragging(false)
      }}
      onDragCancel={() => {
        setActiveId(null)
        setDragOverId(null)
        setIsDragging(false)
      }}
    >
      <div className="kanban">
        {Object.entries(columns).map(([colId, cards]) => (
          <Column
            key={colId}
            id={colId}
            title={columnTitles[colId]!}
            cards={cards}
            dragOverId={dragOverId}
            dragCursor={dragCursor}
            isDragging={isDragging}
            activeDragId={activeId}
          />
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

const kanbanCollisionStrategy: CollisionStrategy = ({
  activeRect,
  activeId,
  activeContainerId,
  containers,
  rects,
  previousCollision,
}) => {
  const itemCollisions = closestCenterStrategy({
    activeRect,
    activeId,
    activeContainerId,
    containers,
    rects,
    previousCollision,
  })
  if (itemCollisions.length > 0) return itemCollisions
  return rectIntersectionStrategy({
    activeRect,
    activeId,
    activeContainerId,
    containers,
    rects,
    previousCollision,
  })
}

function Column({
  id,
  title,
  cards,
  dragOverId,
  dragCursor,
  isDragging,
  activeDragId,
}: {
  id: string
  title: string
  cards: Card[]
  dragOverId: string | null
  dragCursor: { x: number; y: number }
  isDragging: boolean
  activeDragId: string | null
}) {
  const { setNodeRef } = useDroppable({ id, items: cards.map((c) => c.id) })
  const engine = useEngine()
  const columnRect = engine.getRect(id)
  const isPointerInside = columnRect
    ? isPointInRect(dragCursor, columnRect)
    : false
  const isCardOver = dragOverId != null && cards.some((card) => card.id === dragOverId)
  const isActiveDropTarget = isDragging && (dragOverId === id || isCardOver || (!dragOverId && isPointerInside))
  return (
    <div
      ref={setNodeRef}
      className={`column ${isActiveDropTarget ? 'is-over' : ''}`}
      data-column-id={id}
    >
      <div className="column-header">{title}</div>
      {cards.length === 0 && isActiveDropTarget ? (
        <div className="column-empty-slot">Drop here to place first card</div>
      ) : null}
      {cards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          columnId={id}
          dragOverId={dragOverId}
          activeDragId={activeDragId}
          isParentDragging={isDragging}
        />
      ))}
    </div>
  )
}

function CardItem({
  card,
  columnId,
  dragOverId,
  activeDragId,
  isParentDragging,
}: {
  card: Card
  columnId: string
  dragOverId: string | null
  activeDragId: string | null
  isParentDragging: boolean
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: card.id,
    containerId: columnId,
    ariaLabel: `Move card ${card.title}`,
  })
  const isDropTarget = isParentDragging && dragOverId === card.id && dragOverId !== activeDragId
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`card ${isDropTarget ? 'is-over' : ''}`}
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

function resolveTargetColumn(columns: Record<string, Card[]>, overId: string): string | null {
  if (columns[overId] != null) return overId
  return findColumn(columns, overId)
}

function isPointInRect(cursor: { x: number; y: number }, rect: Rect): boolean {
  return cursor.x >= rect.left && cursor.x <= rect.right && cursor.y >= rect.top && cursor.y <= rect.bottom
}
