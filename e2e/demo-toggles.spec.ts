import { test, expect } from '@playwright/test'
import { dispatchSliderChange } from './helpers'

test.describe('Demo: live engine settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h1', { timeout: 10_000 })
  })

  test('threshold slider is present and reflected in the displayed value', async ({ page }) => {
    const slider = page.locator('[data-testid="threshold-slider"]')
    await expect(slider).toBeVisible()
    expect(await page.locator('[data-testid="threshold-value"]').textContent()).toContain('700')

    await dispatchSliderChange(slider, 1500)
    await expect(page.locator('[data-testid="threshold-value"]')).toContainText('1500')
  })

  test('prediction slider is present and reflected in the displayed value', async ({ page }) => {
    const slider = page.locator('[data-testid="prediction-slider"]')
    await expect(slider).toBeVisible()
    expect(await page.locator('[data-testid="prediction-value"]').textContent()).toContain('60')

    await dispatchSliderChange(slider, 120)
    await expect(page.locator('[data-testid="prediction-value"]')).toContainText('120')
  })

  test('engine state inspector shows current status', async ({ page }) => {
    const inspector = page.locator('[data-testid="engine-state"]')
    await expect(inspector).toBeVisible()
    const text = await inspector.textContent()
    expect(text).toContain('status:')
    expect(text).toContain('activeId:')
  })
})
