/**
 * useTextDraggable — React adapter for native HTML5 text drags.
 *
 * Lets a user drag structured text out of an element using the browser's
 * native drag-and-drop API. Pairs naturally with useFileDrop on the
 * receiving side.
 *
 * ```tsx
 * function Token({ value }: { value: string }) {
 *   const { setNodeRef } = useTextDraggable({
 *     getData: () => ({ 'text/plain': value }),
 *     preview: () => {
 *       const el = document.createElement('div')
 *       el.className = 'drag-preview'
 *       el.textContent = value
 *       return el
 *     },
 *   })
 *   return <span ref={setNodeRef}>{value}</span>
 * }
 * ```
 */
import { useCallback, useEffect, useRef } from 'react'
import { attachTextDrag, type UseTextDraggableOptions } from '../adapters/textDrag.js'

export function useTextDraggable(options: UseTextDraggableOptions): {
  setNodeRef: (el: HTMLElement | null) => void
} {
  const elRef = useRef<HTMLElement | null>(null)
  const optsRef = useRef(options)
  optsRef.current = options

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    elRef.current = node
  }, [])

  useEffect(() => {
    const node = elRef.current
    if (!node) return
    const handle = attachTextDrag(node, optsRef.current)
    return () => handle.destroy()
  }, [optsRef.current.disabled])

  return { setNodeRef }
}

// Re-export the option type so users can import from kinetik.
export type { UseTextDraggableOptions } from '../adapters/textDrag.js'
