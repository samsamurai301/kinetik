/**
 * Calendar — move events between days of a week. Demonstrates kanban-style
 * multi-container behavior with small targets (date cells).
 */
import { useState } from 'react'
import { DndContext, useSortable, useSortableContainer, useDroppable } from 'kinetik'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type EventId = string

interface Event {
  id: EventId
  title: string
  day: string
}

const INITIAL: Event[] = [
  { id: 'e1', title: 'Design review', day: 'Mon' },
  { id: 'e2', title: 'Sprint planning', day: 'Tue' },
  { id: 'e3', title: 'Lunch with Maya', day: 'Wed' },
  { id: 'e4', title: 'Pair on auth bug', day: 'Wed' },
  { id: 'e5', title: 'Release v2.1', day: 'Fri' },
  { id: 'e6', title: 'Run 5k', day: 'Sat' },
]

function EventCard({ id, title }: { id: EventId; title: string }) {
  const { setNodeRef, attributes, listeners, style, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`event-card ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      {title}
    </div>
  )
}

function DayColumn({ day, events }: { day: string; events: Event[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const { setNodeRef: setSortableRef } = useSortableContainer(`day-${day}`, events.map((e) => e.id))
  return (
    <div ref={setNodeRef} className={`day-column ${isOver ? 'is-over' : ''}`}>
      <h4>{day}</h4>
      <div ref={setSortableRef} className="day-events">
        {events.map((e) => <EventCard key={e.id} id={e.id} title={e.title} />)}
        {events.length === 0 && <div className="empty-day">empty</div>}
      </div>
    </div>
  )
}

export function Calendar() {
  const [events, setEvents] = useState<Event[]>(INITIAL)

  const handleDragEnd = ({ active, over }: { active: { id: EventId }; over: { id: string } | null }) => {
    if (!over || !over.id.startsWith('day-')) return
    const targetDay = over.id.slice(4)
    setEvents((prev) => prev.map((e) => (e.id === active.id ? { ...e, day: targetDay } : e)))
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="calendar-demo">
        <h3>Weekly calendar — drag events between days</h3>
        <div className="calendar-grid">
          {DAYS.map((day) => (
            <DayColumn key={day} day={day} events={events.filter((e) => e.day === day)} />
          ))}
        </div>
      </div>
    </DndContext>
  )
}
