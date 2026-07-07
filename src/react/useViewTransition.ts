/**
 * useViewTransition — wrap an array-reorder action so the browser animates
 * the reordering for free, using the View Transitions API (Baseline since
 * Oct 2025). Pair with useSortable to get a "free" zero-config smoother
 * experience than FLIP.
 *
 * ```tsx
 * const reorder = useViewTransition()
 * function moveItem(from: string, to: string) {
 *   reorder(() => {
 *     setItems(prev => arrayMove(prev, from, to))
 *   })
 * }
 * ```
 */
import { useCallback, useRef } from 'react'

export function useViewTransition(): (action: () => void) => void {
  const counterRef = useRef(0)
  return useCallback((action: () => void) => {
    const w = typeof window !== 'undefined' ? window : (globalThis as any)
    const startViewTransition =
      (w.document as any)?.startViewTransition?.bind(w.document) ?? null

    if (!startViewTransition) {
      // Browser doesn't support View Transitions — just run the action.
      action()
      return
    }

    // For view-transition-name to map DOM nodes, each item needs a unique
    // name. We assign a transient data attribute hint and the reorder
    // happens inside the transition callback.
    counterRef.current += 1
    // The user's action will mutate state. We just wrap it.
    startViewTransition(() => action())
  }, [])
}

/**
 * Resolve or set a stable view-transition-name for an element. Optional
 * helper for finer control over which nodes participate in the transition.
 *
 * ```tsx
 * <li style={{ viewTransitionName: viewTransitionName(id) }} />
 * ```
 */
export function viewTransitionName(id: string): string {
  // IDs need to be CSS-safe and globally unique.
  return `kinetik-${encodeURIComponent(id)}`
}
