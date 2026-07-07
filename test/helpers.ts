/**
 * Test helpers for kinetik.
 *
 * The hardest part of testing a drag-and-drop library is simulating realistic
 * pointer sequences. These helpers abstract the boilerplate.
 */

/**
 * Create a PointerEvent with sensible defaults for drag testing.
 */
export function makePointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: Partial<PointerEventInit> = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: 0,
    clientY: 0,
    ...init,
  })
}

export function firePointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: Partial<PointerEventInit> = {},
): void {
  const event = makePointerEvent(type, init)
  target.dispatchEvent(event)
}

/**
 * Simulate a complete drag interaction from one point to another.
 * Fires pointerdown → many moves → pointerup with rAF coalescing respected.
 */
export async function simulateDrag(
  source: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps = 10,
): Promise<void> {
  firePointer(source, 'pointerdown', { clientX: fromX, clientY: fromY })

  // Let effects flush
  await Promise.resolve()
  await Promise.resolve()

  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    const y = fromY + ((toY - fromY) * i) / steps
    firePointer(document, 'pointermove', { clientX: x, clientY: y })
  }

  // Wait for rAF coalescing
  await waitFrames(2)

  firePointer(document, 'pointerup', { clientX: toX, clientY: toY })

  // Wait for drop animations
  await wait(60)
}

/**
 * Mock DOMRect — useful when you don't want happy-dom to compute real rects.
 */
export function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
): DOMRect {
  return {
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    width,
    height,
    x,
    y,
    toJSON() {
      return { top: y, left: x, right: x + width, bottom: y + height, width, height, x, y }
    },
  } as DOMRect
}

/**
 * Create a div with known position. Useful for setting up drag scenarios.
 */
export function makeDraggable(id: string, options: {
  x?: number
  y?: number
  width?: number
  height?: number
} = {}): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-draggable-id', id)
  el.id = `draggable-${id}`
  el.style.position = 'absolute'
  el.style.left = `${options.x ?? 0}px`
  el.style.top = `${options.y ?? 0}px`
  el.style.width = `${options.width ?? 100}px`
  el.style.height = `${options.height ?? 40}px`
  document.body.appendChild(el)
  return el
}

/**
 * Create a container div for droppable targets.
 */
export function makeContainer(id: string, options: {
  x?: number
  y?: number
  width?: number
  height?: number
} = {}): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-container-id', id)
  el.id = `container-${id}`
  el.style.position = 'absolute'
  el.style.left = `${options.x ?? 0}px`
  el.style.top = `${options.y ?? 0}px`
  el.style.width = `${options.width ?? 400}px`
  el.style.height = `${options.height ?? 400}px`
  document.body.appendChild(el)
  return el
}

/**
 * Wait for N animation frames.
 *
 * Works with the test setup's sync rAF shim by also yielding to microtasks
 * so chained rAFs (via awaits in the engine) can re-queue callbacks.
 */
export async function waitFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
    // Yield once more so microtask-scheduled rAFs can be re-queued.
    await Promise.resolve()
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}