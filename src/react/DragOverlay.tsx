/**
 * DragOverlay — a floating preview of the dragged item.
 *
 *   const [active, setActive] = useState<string | null>(null)
 *   <DndContext onDragStart={setActive} onDragEnd={() => setActive(null)}>
 *     <DragOverlay>{active ? <Preview id={active} /> : null}</DragOverlay>
 *   </DndContext>
 *
 * The overlay is rendered on its own compositor layer (position: fixed +
 * transform) so it doesn't trigger layout on the source or its siblings.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useDragState, useEngine } from './DndContext.js'

export interface DragOverlayProps {
  children: ReactNode | ((args: { activeId: string | number | null }) => ReactNode)
}

export function DragOverlay({ children }: DragOverlayProps) {
  const state = useDragState()
  const engine = useEngine()
  if (state.status !== 'dragging' || state.activeId == null) return null
  const r = engine.getInitialRect(state.activeId)
  if (!r) return null

  const style: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: r.width,
    height: r.height,
    transform: `translate3d(${r.left + state.delta.x}px, ${r.top + state.delta.y}px, 0) scale(1.03)`,
    pointerEvents: 'none',
    zIndex: 10000,
    willChange: 'transform',
    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.18))',
  }

  return (
    <div style={style} data-drag-overlay="">
      {typeof children === 'function' ? children({ activeId: state.activeId }) : children}
    </div>
  )
}
