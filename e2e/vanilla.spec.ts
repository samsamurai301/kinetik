import { test, expect } from '@playwright/test'

test.describe('Vanilla (no React) demo', () => {
  test('loads and renders sortable list', async ({ page }) => {
    await page.goto('/vanilla.html')
    await expect(page.locator('h1')).toContainText('kinetik')
    await expect(page.locator('h1')).toContainText('vanilla JS')
    const li = page.locator('li')
    await expect(li.first()).toBeVisible()
  })

  test('drag without React moves the item', async ({ page }) => {
    await page.goto('/vanilla.html')
    const items = page.locator('li')
    await expect(items.first()).toBeVisible()

    const initial = (await items.allTextContents()).slice()

    const fromBox = await items.first().boundingBox()
    const toBox = await items.nth(1).boundingBox()
    if (!fromBox || !toBox) throw new Error('no box')

    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(fromBox.x + fromBox.width / 2 + 6, fromBox.y + fromBox.height / 2 + 6)
    for (let i = 1; i <= 10; i++) {
      const x = fromBox.x + fromBox.width / 2 + ((toBox.x - fromBox.x) * i) / 10
      const y = fromBox.y + fromBox.height / 2 + ((toBox.y - fromBox.y) * i) / 10
      await page.mouse.move(x, y)
    }
    await page.mouse.up()
    await page.waitForTimeout(500)

    const after = (await items.allTextContents()).slice()
    expect(after[0]).not.toBe(initial[0])
  })
})
