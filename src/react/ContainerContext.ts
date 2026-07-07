/**
 * Container context — provides the container id to nested useSortable items.
 *
 * For non-virtualized use (children are descendants of the container element),
 * the auto-detection via DOM walking is fine. For virtualized lists where
 * children's parents are detached (e.g. react-virtual uses a portal-like
 * pattern), the explicit context avoids any DOM traversal.
 */
import { createContext, useContext } from 'react'
import type { Id } from '../core/types.js'

const ContainerContext = createContext<Id | null>(null)

export const ContainerProvider = ContainerContext.Provider

export function useNearestContainerId(): Id | null {
  return useContext(ContainerContext)
}
