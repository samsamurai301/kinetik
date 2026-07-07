/**
 * useFileDrop — React adapter for native HTML5 file drops.
 *
 * ```tsx
 * function Dropzone({ onUpload }: { onUpload: (files: File[]) => void }) {
 *   const { setNodeRef, isOver } = useFileDrop({
 *     accept: ['image/*'],
 *     onFiles: onUpload,
 *   })
 *   return (
 *     <div ref={setNodeRef} className={isOver ? 'over' : ''}>
 *       Drop images here
 *     </div>
 *   )
 * }
 * ```
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { attachFileDrop, type UseFileDropOptions, type FileDropHookReturn } from '../adapters/fileDrop.js'

export function useFileDrop(options: UseFileDropOptions): FileDropHookReturn {
  const elRef = useRef<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)
  const optsRef = useRef(options)
  optsRef.current = options

  const setNodeRef = useCallback((node: HTMLElement | null) => {
    elRef.current = node
    if (!node) return
  }, [])

  useEffect(() => {
    const node = elRef.current
    if (!node) return
    // Wrap the user's callbacks to also update local state.
    const opts: UseFileDropOptions = {
      ...optsRef.current,
      onDragOverChange: (over) => {
        setIsOver(over)
        optsRef.current.onDragOverChange?.(over)
      },
    }
    const handle = attachFileDrop(node, opts)
    return () => handle.destroy()
  }, [optsRef.current.disabled])

  return { setNodeRef, isOver }
}

// Re-export the option types so users can import them from kinetik.
export type { UseFileDropOptions, FileDropHookReturn } from '../adapters/fileDrop.js'
