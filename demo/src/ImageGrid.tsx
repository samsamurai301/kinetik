/**
 * ImageGrid — a 3xN mosaic of images. Demonstrates free-form dragging with
 * no implicit reordering (drop position is explicit via DragOverlay).
 */
import { useState, type CSSProperties } from 'react'
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent } from 'kinetik'

const INITIAL = [
  'https://picsum.photos/seed/1/200/200',
  'https://picsum.photos/seed/2/200/200',
  'https://picsum.photos/seed/3/200/200',
  'https://picsum.photos/seed/4/200/200',
  'https://picsum.photos/seed/5/200/200',
  'https://picsum.photos/seed/6/200/200',
  'https://picsum.photos/seed/7/200/200',
  'https://picsum.photos/seed/8/200/200',
  'https://picsum.photos/seed/9/200/200',
]

function Image({ src, alt }: { src: string; alt: string }) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useDraggable({ id: src })
  return (
    <div
      ref={setNodeRef}
      className={`image-tile ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <img src={src} alt={alt} draggable={false} />
    </div>
  )
}

function DropZone({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`drop-zone ${isOver ? 'is-over' : ''}`}>
      {label}
    </div>
  )
}

export function ImageGrid() {
  const [images, setImages] = useState(INITIAL)
  const [activeId, setActiveId] = useState<string | null>(null)

  const handleDragStart = (id: string) => setActiveId(id)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    if (e.over.id === 'trash') {
      setImages((imgs) => imgs.filter((i) => i !== e.active.id))
    }
  }

  return (
    <DndContext
      onDragStart={(id) => handleDragStart(String(id))}
      onDragEnd={handleDragEnd}
    >
      <div className="image-grid-demo">
        <h3>Drag images to trash</h3>
        <div className="image-grid">
          {images.map((src) => <Image key={src} src={src} alt="seed" />)}
        </div>
        <DropZone id="trash" label="🗑 Drop here to delete" />
        <DragOverlay>
          {activeId ? <img src={activeId} alt="" className="overlay-img" /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
