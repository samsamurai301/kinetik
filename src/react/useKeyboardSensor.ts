/**
 * useKeyboardSensor — accessibility-driven drag.
 *
 * Wires up keyboard events on a draggable element so it can be picked up,
 * moved, and dropped without using the pointer at all. This is the single
 * biggest accessibility win a drag-and-drop library can ship: without it,
 * keyboard and screen-reader users are completely locked out.
 *
 * Usage:
 *   const { attributes, listeners } = useSortable({ id })
 *   // OR for custom setups:
 *   const kbd = useKeyboardSensor({ id })
 *   return <div {...attributes} {...listeners} {...kbd.attributes} {...kbd.listeners}>...</div>
 *
 * Keys:
 *   Space / Enter  → pick up / drop
 *   Arrow keys    → move one step in that direction
 *   Escape        → cancel
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useEngine } from './DndContext.js'

export interface UseKeyboardSensorOptions {
  id: string | number
  disabled?: boolean
}

export interface UseKeyboardSensorReturn {
  attributes: Record<string, unknown>
  listeners: Record<string, unknown>
}

export function useKeyboardSensor({ id, disabled }: UseKeyboardSensorOptions): UseKeyboardSensorReturn {
  const engine = useEngine()

  // Use a ref so we always read the latest value without re-binding listeners.
  const stateRef = useRef({ id, disabled })
  stateRef.current = { id, disabled }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const { id, disabled } = stateRef.current
      if (disabled) return

      // Space / Enter on the focused element toggles pickup/drop.
      if (e.key === ' ' || e.key === 'Enter') {
        const s = engine.getState()
        if (s.status === 'idle') {
          if (engine.beginKeyboardDrag(id)) {
            e.preventDefault()
            announce(`Picked up item ${id}. Use arrow keys to move, space to drop, escape to cancel.`)
          }
        } else if (s.activeId === id) {
          engine.keyboardComplete()
          e.preventDefault()
          announce(`Dropped item ${id}.`)
        }
        return
      }

      // Escape cancels an in-flight drag.
      if (e.key === 'Escape') {
        const s = engine.getState()
        if (s.status !== 'idle') {
          // engine.cancel() handles Escape internally too, but ensure we announce.
          announce(`Drag cancelled.`)
        }
        return
      }

      // Arrow keys advance the active drag.
      if (e.key.startsWith('Arrow')) {
        const s = engine.getState()
        if (s.status !== 'dragging') return
        let dir: 'up' | 'down' | 'left' | 'right' | null = null
        switch (e.key) {
          case 'ArrowUp': dir = 'up'; break
          case 'ArrowDown': dir = 'down'; break
          case 'ArrowLeft': dir = 'left'; break
          case 'ArrowRight': dir = 'right'; break
        }
        if (dir) {
          e.preventDefault()
          const ok = engine.keyboardAdvance(dir)
          if (ok) announce(`Moved ${dir}, now over ${engine.getState().overId ?? 'nothing'}.`)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [engine])

  return useMemo(
    () => ({
      attributes: {
        tabIndex: disabled ? -1 : 0,
        role: 'button',
        'aria-pressed': false,
      },
      listeners: {},
    }),
    [disabled],
  )
}

/**
 * announce — write a string to a polite aria-live region so screen readers
 * (VoiceOver, NVDA, JAWS) speak the message. The region is created lazily
 * on first call. Reused across announcements.
 */
function announce(message: string): void {
  if (typeof document === 'undefined') return
  let region = document.getElementById('__kinetik_live') as HTMLDivElement | null
  if (!region) {
    region = document.createElement('div')
    region.id = '__kinetik_live'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    region.style.position = 'absolute'
    region.style.width = '1px'
    region.style.height = '1px'
    region.style.padding = '0'
    region.style.margin = '-1px'
    region.style.overflow = 'hidden'
    region.style.clip = 'rect(0,0,0,0)'
    region.style.whiteSpace = 'nowrap'
    region.style.border = '0'
    document.body.appendChild(region)
  }
  // Re-set textContent to force SR to re-announce even if message is identical.
  region.textContent = ''
  // Use a microtask so SR picks up the change reliably.
  Promise.resolve().then(() => { region!.textContent = message })
}

/** Style helper: cursor:grab + cursor:grabbing on active. */
export const draggableCursor: CSSProperties = {
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
}
