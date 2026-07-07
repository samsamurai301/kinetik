/**
 * 'kinetik/adapters' — native HTML5 drag adapters.
 *
 *   import { useFileDrop, useTextDraggable } from 'kinetik/adapters'
 *
 * Adapters wrap the native `dragstart` / `dragover` / `drop` events so you can
 * use them with kinetik's state machine instead of the HTML5 backend.
 */
export {
  useFileDrop,
  type FileDropHookReturn,
} from '../react/useFileDrop.js'
export {
  useTextDraggable,
  type UseTextDraggableOptions,
} from '../react/useTextDraggable.js'
