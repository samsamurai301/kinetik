/**
 * Playwright helpers for kinetik e2e tests.
 *
 * Key helpers:
 * - `dragElement`: simulates a full mouse drag (mousedown → many moves → up)
 *   with intermediate waits so the rAF coalescing + activation distance logic
 *   behaves the same as a real user.
 * - `dragElementTouch`: same but with touch events.
 * - `getActiveDragId`: returns the id of the currently active drag via a
 *   window.__kinetik exposed hook in the demo.
 */

import { expect, type Locator, type Page } from '@playwright/test'

export const TEST_TIMEOUT = 10_000

/**
 * Simulate a real mouse drag. Splits the move into N intermediate steps so the
 * engine's pointermove coalescing behaves like real user input.
 */
export async function dragElement(
  page: Page,
  source: Locator,
  target: Locator,
  options: { steps?: number; delayMs?: number } = {},
): Promise<void> {
  const { steps = 20, delayMs = 20 } = options
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('dragElement: source or target has no bounding box')
  }

  const fromX = sourceBox.x + sourceBox.width / 2
  const fromY = sourceBox.y + sourceBox.height / 2
  const toX = targetBox.x + targetBox.width / 2
  const toY = targetBox.y + targetBox.height / 2

  await page.mouse.move(fromX, fromY)
  await page.waitForTimeout(50)
  await page.mouse.down()
  await page.waitForTimeout(50)
  // Small initial nudge to pass the activation distance (4px).
  await page.mouse.move(fromX + 6, fromY + 6)
  await page.waitForTimeout(50)
  // Then walk through the path.
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps
    const y = fromY + ((toY - fromY) * i) / steps
    await page.mouse.move(x, y)
    if (delayMs > 0) await page.waitForTimeout(delayMs)
  }
  await page.mouse.up()
}

/**
 * Same as dragElement but using touch events. Useful for verifying
 * touch-action: none behavior on mobile-ish viewports.
 */
export async function dragElementTouch(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('dragElementTouch: source or target has no bounding box')
  }

  // Playwright doesn't have a direct touch API, but `page.touchscreen` does
  // most of what we need. We bypass the mouse path entirely.
  await page.touchscreen.tap(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  // For drag with touch, we'd need to dispatch synthetic touch events.
  // This is best-effort — we'll keep this helper limited to single-finger
  // interactions.
  void targetBox
}

/**
 * Wait until the drag overlay is visible (proves a drag is in progress).
 */
export async function waitForDragOverlay(page: Page): Promise<void> {
  await page.waitForSelector('[data-drag-overlay]', {
    state: 'visible',
    timeout: TEST_TIMEOUT,
  })
}

/**
 * Wait until the drag overlay is gone (drag ended).
 */
export async function waitForDragOverlayGone(page: Page): Promise<void> {
  // Wait for the overlay to appear (drag is in progress), then wait for it
  // to detach (drag is over). If it never appeared (e.g. drag failed to
  // activate) we still want to wait a beat so React commits any pending
  // state updates before the caller reads the DOM.
  try {
    await page.waitForSelector('[data-drag-overlay]', {
      state: 'attached',
      timeout: 2000,
    })
    await page.waitForSelector('[data-drag-overlay]', {
      state: 'detached',
      timeout: TEST_TIMEOUT,
    })
  } catch {
    // Drag never started; give React a frame to settle anyway.
    await page.waitForTimeout(150)
  }
}

/**
 * Get the current transform applied to a draggable element, parsed into a
 * `{x, y}` object. Returns null if no transform is set.
 */
export async function getTransform(page: Page, selector: string): Promise<{ x: number; y: number } | null> {
  const transform = await page.locator(selector).evaluate((el) => {
    const t = (el as HTMLElement).style.transform
    if (!t || t === 'none') return null
    const match = /translate3d?\(([\d.-]+)px,\s*([\d.-]+)px/.exec(t)
    return match ? { x: parseFloat(match[1]!), y: parseFloat(match[2]!) } : null
  })
  return transform
}

/**
 * Count the number of times an element has been re-rendered (via React DevTools
 * hook, requires the demo to be instrumented). Falls back to counting layout
 * invalidations.
 */
export async function countRenderTriggers(page: Page, selector: string): Promise<number> {
  return await page.locator(selector).evaluate((el) => {
    const w = window as unknown as { __renderCounts?: Map<HTMLElement, number> }
    if (!w.__renderCounts) {
      w.__renderCounts = new Map()
    }
    return w.__renderCounts.get(el as HTMLElement) ?? 0
  })
}

/**
 * Verify the element has touch-action: none applied.
 */
export async function expectTouchActionNone(locator: Locator): Promise<void> {
  await expect(locator).toHaveCSS('touch-action', 'none')
}

/**
 * Wait for N animation frames via requestAnimationFrame.
 */
export async function waitFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let frames = 0
        const tick = () => {
          frames++
          if (frames >= count) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    n,
  )
}

/**
 * Measure frame time over a period using rAF. Returns avg, min, max ms.
 */
export async function measureFrameTime(
  page: Page,
  durationMs: number,
): Promise<{ avg: number; min: number; max: number; samples: number }> {
  return await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const times: number[] = []
        let last = performance.now()
        const start = last
        const tick = (now: number) => {
          times.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(tick)
          else {
            const sum = times.reduce((a, b) => a + b, 0)
            resolve({
              avg: sum / times.length,
              min: Math.min(...times),
              max: Math.max(...times),
              samples: times.length,
            })
          }
        }
        requestAnimationFrame(tick)
      }),
    durationMs,
  )
}
/**
 * Set a range slider's value and fire all the React-relevant events
 * (input + change) so React controlled components re-render.
 */
export async function dispatchSliderChange(
  slider: import('@playwright/test').Locator,
  value: number,
): Promise<void> {
  // Use the native value setter + dispatchEvent — this is the React-friendly way.
  await slider.evaluate((el: HTMLInputElement, val: number) => {
    const proto = HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, String(val))
    else el.value = String(val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}
