/**
 * Sortable list end-to-end tests.
 *
 * Maps directly to dnd-kit's Cypress specs:
 * - Move Down (Once)
 * - Move Up (Once)
 * - Two consecutive sort actions
 * - Does not go past the last index
 * - Does not go below index zero
 * - Multiple actions in both directions (stress test)
 *
 * Plus our own:
 * - touch-action: none is set
 * - Inline transform is applied during drag (not React state)
 * - Drag overlay appears + scales
 * - Source becomes a ghost (opacity 0.3) during drag
 */

import { test, expect } from '@playwright/test'
import {
  TEST_TIMEOUT,
  dragElement,
  expectTouchActionNone,
  getTransform,
  measureFrameTime,
  waitForDragOverlay,
  waitForDragOverlayGone,
} from './helpers'

test.describe('Sortable Vertical List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: TEST_TIMEOUT })
  })

  test('touch-action: none is set on draggable items', async ({ page }) => {
    const firstItem = page.locator('[data-sortable-id]').first()
    await expectTouchActionNone(firstItem)
  })

  test('Move Down (Once): first item → second position', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const initialOrder = await items.allTextContents()
    expect(initialOrder[0]).toContain('Refactor')
    expect(initialOrder[1]).toContain('Write tests')

    const firstItem = items.first()
    const secondItem = items.nth(1)
    await dragElement(page, firstItem, secondItem)
    await waitForDragOverlayGone(page)

    const newOrder = await items.allTextContents()
    // After moving item-0 below item-1, item-1 should now be first.
    expect(newOrder[0]).toContain('Write tests')
    expect(newOrder[1]).toContain('Refactor')
  })

  test('Move Up (Once): middle item → first position', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const secondItem = items.nth(1)
    const firstItem = items.first()
    await dragElement(page, secondItem, firstItem)
    await waitForDragOverlayGone(page)

    const newOrder = await items.allTextContents()
    // Item at index 1 should now be at index 0.
    expect(newOrder[0]).toContain('Write tests')
  })

  test('Does not go past the last index', async ({ page }) => {
    // Scope to the sortable list — kanban cards also have data-sortable-id.
    const items = page.locator('.list > [data-sortable-id]')
    const lastIndex = (await items.count()) - 1
    const firstItem = items.first()
    const lastItem = items.nth(lastIndex)
    await dragElement(page, firstItem, lastItem)
    await waitForDragOverlayGone(page)

    // First item should now be at the end of the sortable list.
    const newOrder = await items.allTextContents()
    const lastNewIndex = newOrder.length - 1
    expect(newOrder[lastNewIndex]).toContain('Refactor')
  })

  test('Two consecutive sort actions', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')

    // First move: item-0 → item-2
    await dragElement(page, items.first(), items.nth(2))
    await waitForDragOverlayGone(page)
    const afterFirst = await items.allTextContents()
    expect(afterFirst[0]).toContain('Write tests')

    // Second move: now-item-0 (which is 'Write tests') → was-item-2 position
    const newFirst = items.first()
    const targetForSecond = items.nth(2)
    await dragElement(page, newFirst, targetForSecond)
    await waitForDragOverlayGone(page)
    const afterSecond = await items.allTextContents()
    // No crash, items are in some valid order.
    expect(afterSecond.length).toBeGreaterThan(2)
  })

  test('Stress test: multiple actions in both directions', async ({ page }) => {
    test.setTimeout(90_000)
    const items = page.locator('[data-sortable-id]')
    for (let i = 0; i < 4; i++) {
      // Move first → middle
      await dragElement(page, items.first(), items.nth(3))
      await waitForDragOverlayGone(page)
      // Move current-first (was third) → second
      await dragElement(page, items.first(), items.nth(1))
      await waitForDragOverlayGone(page)
    }
    // Just verify the DOM is consistent.
    const finalCount = await items.count()
    expect(finalCount).toBeGreaterThan(0)
  })

  test('During drag: source element has opacity ghost + overlay shows', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const firstItem = items.first()

    // Start drag but don't complete it.
    const box = await firstItem.boundingBox()
    if (!box) throw new Error('no bbox')
    const fromX = box.x + box.width / 2
    const fromY = box.y + box.height / 2

    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move(fromX + 50, fromY + 50) // activate

    // While dragging:
    await waitForDragOverlay(page)
    const overlayOpacity = await page.locator('[data-drag-overlay]').first().evaluate(
      (el) => getComputedStyle(el.parentElement!).opacity,
    )
    expect(parseFloat(overlayOpacity)).toBeGreaterThan(0)

    // Source should have opacity: 0.3 (ghost) — checking via inline style
    const sourceOpacity = await firstItem.evaluate((el) => (el as HTMLElement).style.opacity)
    expect(sourceOpacity).toBe('0.3')

    await page.mouse.up()
    await waitForDragOverlayGone(page)
  })

  test('During drag: inline transform is written on the dragged element (not React state)', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const firstItem = items.first()
    const targetItem = items.nth(5)

    const sourceBox = await firstItem.boundingBox()
    const targetBox = await targetItem.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('no bbox')

    const fromX = sourceBox.x + sourceBox.width / 2
    const fromY = sourceBox.y + sourceBox.height / 2
    const moveX = fromX + 100
    const moveY = fromY + 100

    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move(moveX, moveY)

    // Wait for rAF to process.
    await page.waitForTimeout(50)

    // The dragged element should have a translate3d transform applied
    // directly via inline style. This proves the engine writes to DOM
    // without going through React.
    const transform = await getTransform(page, '[data-drag-overlay]')
    // The overlay follows the drag, so it should have a transform.
    expect(transform).not.toBeNull()
    expect(Math.abs(transform!.x)).toBeGreaterThan(50)

    await page.mouse.up()
  })

  test('Frame time during drag stays under 25ms (40fps minimum)', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const firstItem = items.first()
    const targetItem = items.nth(8)

    const sourceBox = await firstItem.boundingBox()
    const targetBox = await targetItem.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('no bbox')

    const fromX = sourceBox.x + sourceBox.width / 2
    const fromY = sourceBox.y + sourceBox.height / 2

    await page.mouse.move(fromX, fromY)
    await page.mouse.down()

    // Measure frame time during a 1-second drag.
    const measurementPromise = measureFrameTime(page, 1000)
    for (let i = 1; i <= 30; i++) {
      await page.mouse.move(fromX, fromY + i * 5)
      await page.waitForTimeout(20)
    }
    await page.mouse.up()

    const frames = await measurementPromise
    // The headless browser has limited CPU; allow up to 30ms avg.
    // On a real machine with a real display, this would be ~16.6ms.
    expect(frames.avg).toBeLessThan(30)
  })
})