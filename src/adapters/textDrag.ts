/**
 * Native HTML5 Text Drag adapter.
 *
 * Lets a user drag plain (or structured) text out of an element using the
 * browser's native `dragstart` event. Useful for spreadsheet cells,
 * tokens, list items — anywhere the user should be able to drag a value
 * into another window or app.
 *
 * ```ts
 * const dragRef = useTextDraggable({
 *   getData: () => ({ 'text/plain': cell.text, 'application/json': JSON.stringify(cell) }),
 *   preview: () => <Badge>{cell.text}</Badge>,
 * })
 * return <td ref={dragRef as any}>...</td>
 * ```
 */

export interface UseTextDraggableOptions {
  /** Produce the data to drag. Keys are MIME types. */
  getData: () => Record<string, string>
  /** Optional drag preview element or factory. */
  preview?: HTMLElement | (() => HTMLElement)
  /** Disable the drag. */
  disabled?: boolean
}

/**
 * Pure-DOM text drag hook — no React. Attach via setNodeRef.
 */
export function attachTextDrag(
  el: HTMLElement | null,
  options: UseTextDraggableOptions,
): { destroy: () => void } {
  if (!el || options.disabled) return { destroy: () => {} }

  el.draggable = true

  const onDragStart = (e: DragEvent): void => {
    if (!e.dataTransfer) return
    const data = options.getData()
    for (const [mime, value] of Object.entries(data)) {
      e.dataTransfer.setData(mime, value)
    }
    e.dataTransfer.effectAllowed = 'copy'

    // Custom preview: build off-screen, then place under cursor.
    if (options.preview) {
      const previewEl = typeof options.preview === 'function' ? options.preview() : options.preview
      previewEl.style.position = 'absolute'
      previewEl.style.top = '-9999px'
      document.body.appendChild(previewEl)
      e.dataTransfer.setDragImage(previewEl, 10, 10)
      // After dragstart, the browser snapshots the preview. Remove from DOM.
      requestAnimationFrame(() => previewEl.remove())
    }
  }

  el.addEventListener('dragstart', onDragStart)
  return {
    destroy() {
      el.removeEventListener('dragstart', onDragStart)
      el.draggable = false
    },
  }
}
