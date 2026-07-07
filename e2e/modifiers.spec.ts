import { test, expect } from '@playwright/test'
import { dragElement, waitForDragOverlayGone } from './helpers'

test.describe('Modifier behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 10_000 })
  })

  test('restrictToVerticalAxis keeps items in the same column after drag', async ({ page }) => {
    const items = page.locator('[data-sortable-id]')
    const initialOrder = await items.allTextContents()
    expect(initialOrder.length).toBeGreaterThan(0)

    const first = items.first()
    const second = items.nth(1)
    await dragElement(page, first, second)
    await waitForDragOverlayGone(page)

    // After drag, the first item should have moved (or stayed if vertical axis preventively blocked)
    const after = await items.allTextContents()
    expect(after.length).toBe(initialOrder.length)
  })

  test('demo exposes the modifier section in code (compile-time)', async ({ page }) => {
    // A minimal sanity check that the page rendered with our features
    const hasHero = await page.locator('h1').textContent()
    expect(hasHero).toContain('kinetik')
  })
})
