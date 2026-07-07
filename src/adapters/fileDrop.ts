/**
 * Native HTML5 File Drop adapter.
 *
 * Listens for browser-native `drop` events on a container element, reads
 * `DataTransfer.files`, and forwards them via the callback. Compatible with
 * the rest of kinetik: you can mix it with useDraggable/useDroppable
 * without conflict, because the browser's native drag events are not
 * consumed by the pointer-event-based engine.
 *
 * ```ts
 * const dropRef = useFileDrop({
 *   accept: ['image/*'],
 *   onFiles: (files) => upload(files),
 *   onDragOverChange: (over) => setHovered(over),
 * })
 * return <div ref={dropRef as any}>Drop files here</div>
 * ```
 */

export interface UseFileDropOptions {
  /** File types to accept. Examples: ['image/*'], ['.pdf'], ['application/json']. */
  accept?: string[]
  /** Called when files are dropped. */
  onFiles: (files: File[]) => void
  /** Called when files are dragged over the element (true) vs leave (false). */
  onDragOverChange?: (over: boolean) => void
  /** Called when drop is rejected because accept criteria failed. */
  onReject?: (reason: string) => void
  /** Disable the drop. */
  disabled?: boolean
}

export interface FileDropHookReturn {
  /** Ref to attach to the drop container element. */
  setNodeRef: (el: HTMLElement | null) => void
  /** Currently being dragged over. */
  isOver: boolean
}

/** Validate a file against accept patterns. */
function accepts(file: File, patterns: string[]): boolean {
  if (patterns.length === 0) return true
  for (const pat of patterns) {
    if (pat === file.type) return true
    if (pat.endsWith('/*') && file.type.startsWith(pat.slice(0, -1))) return true
    if (pat.startsWith('.') && file.name.toLowerCase().endsWith(pat.toLowerCase())) return true
  }
  return false
}

/**
 * Pure-DOM file drop hook — no React. Attach via setNodeRef.
 *
 * This is intentionally framework-agnostic so it can be wired from any view
 * layer. The React-friendly wrapper lives in src/adapters/react/.
 */
export function attachFileDrop(
  el: HTMLElement | null,
  options: UseFileDropOptions,
): { destroy: () => void; isOver: () => boolean } {
  if (!el || options.disabled) {
    return { destroy: () => {}, isOver: () => false }
  }

  let over = false
  const onDragOver = (e: DragEvent): void => {
    if (!e.dataTransfer) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!over) {
      over = true
      options.onDragOverChange?.(true)
    }
  }
  const onDragLeave = (e: DragEvent): void => {
    if (over && (!e.relatedTarget || !el.contains(e.relatedTarget as Node))) {
      over = false
      options.onDragOverChange?.(false)
    }
  }
  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    over = false
    options.onDragOverChange?.(false)
    if (!e.dataTransfer) return
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0) return
    if (options.accept && !files.every((f) => accepts(f, options.accept!))) {
      options.onReject?.('Some files do not match the accepted types.')
      return
    }
    options.onFiles(files)
  }

  el.addEventListener('dragover', onDragOver)
  el.addEventListener('dragleave', onDragLeave)
  el.addEventListener('drop', onDrop)
  // Suppress the element being a drop target for browsers that show cursor changes.
  el.style.touchAction = 'manipulation'

  return {
    destroy() {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    },
    isOver: () => over,
  }
}
