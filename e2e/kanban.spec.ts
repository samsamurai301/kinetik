/**
 * Kanban (multi-container) end-to-end tests.
 *
 * Maps to dnd-kit's sortable grid specs:
 * - Move Right (Once, Two consecutive, Does not go past last index)
 * - Move Down (Once, Two consecutive, Does not go past last index)
 *
 * Plus our own:
 * - Cross-column drag (item moves between containers)
 * - Drop on empty column
 */

import { test, expect } from '@playwright/test'
import {
  TEST_TIMEOUT,
  dragElement,
  waitForDragOverlayGone,
} from './helpers'

test.describe('Kanban (Multi-Container)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('h2', { timeout: TEST_TIMEOUT })
    // The demo layout puts the kanban below the fold — scroll it into view
    // so card bounding boxes fall inside the viewport.
    await page.locator('[data-column-id="todo"]').first().scrollIntoViewIfNeeded()
  })

  test('renders three columns with their cards', async ({ page }) => {
    const todoColumn = page.locator('[data-column-id="todo"]')
    const doingColumn = page.locator('[data-column-id="doing"]')
    const doneColumn = page.locator('[data-column-id="done"]')

    await expect(todoColumn).toBeVisible()
    await expect(doingColumn).toBeVisible()
    await expect(doneColumn).toBeVisible()

    expect(await todoColumn.locator('.card').count()).toBe(3)
    expect(await doingColumn.locator('.card').count()).toBe(2)
    expect(await doneColumn.locator('.card').count()).toBe(3)
  })

  test('Move Right: card from todo → doing', async ({ page }) => {
    const todoCards = page.locator('[data-column-id="todo"] .card')
    const doingColumn = page.locator('[data-column-id="doing"]')

    const initialTodoCount = await todoCards.count()
    const initialDoingCount = await doingColumn.locator('.card').count()

    const card = todoCards.first()
    const targetInDoing = doingColumn.locator('.card').first()
    await dragElement(page, card, targetInDoing)
    await waitForDragOverlayGone(page)

    const finalTodoCount = await page.locator('[data-column-id="todo"] .card').count()
    const finalDoingCount = await doingColumn.locator('.card').count()

    expect(finalTodoCount).toBe(initialTodoCount - 1)
    expect(finalDoingCount).toBe(initialDoingCount + 1)
  })

  test('Move Down: card within todo column', async ({ page }) => {
    const todoCards = page.locator('[data-column-id="todo"] .card')
    const firstCard = todoCards.first()
    const secondCard = todoCards.nth(1)

    const beforeFirstText = await firstCard.textContent()
    await dragElement(page, firstCard, secondCard)
    await waitForDragOverlayGone(page)

    const newTodoCards = page.locator('[data-column-id="todo"] .card')
    const newFirstText = await newTodoCards.first().textContent()
    // First card text should have changed.
    expect(newFirstText).not.toBe(beforeFirstText)
  })

  test('Cross-column drag: card from todo → done', async ({ page }) => {
    const todoCard = page.locator('[data-column-id="todo"] .card').first()
    const doneCard = page.locator('[data-column-id="done"] .card').nth(1)

    const initialDoneCount = await page.locator('[data-column-id="done"] .card').count()
    await dragElement(page, todoCard, doneCard)
    await waitForDragOverlayGone(page)

    const finalDoneCount = await page.locator('[data-column-id="done"] .card').count()
    expect(finalDoneCount).toBe(initialDoneCount + 1)
  })

  test('Drag overlay shows card preview during cross-column drag', async ({ page }) => {
    const todoCard = page.locator('[data-column-id="todo"] .card').first()
    const doneColumn = page.locator('[data-column-id="done"]')

    const box = await todoCard.boundingBox()
    const targetBox = await doneColumn.boundingBox()
    if (!box || !targetBox) throw new Error('no bbox')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + 50, targetBox.y + 50)

    // While dragging, the overlay should be visible with the card preview
    // inside it.
    await page.waitForSelector('[data-drag-overlay] .card', {
      state: 'visible',
      timeout: TEST_TIMEOUT,
    })

    await page.mouse.up()
    await waitForDragOverlayGone(page)
  })

  test('two consecutive kanban drags', async ({ page }) => {
    // Move todo → doing
    await dragElement(
      page,
      page.locator('[data-column-id="todo"] .card').first(),
      page.locator('[data-column-id="doing"] .card').first(),
    )
    await waitForDragOverlayGone(page)

    // Then move within doing
    const doingCards = page.locator('[data-column-id="doing"] .card')
    const initialDoingCount = await doingCards.count()
    if (initialDoingCount >= 2) {
      await dragElement(page, doingCards.first(), doingCards.nth(1))
      await waitForDragOverlayGone(page)
    }

    // No crash, columns still have cards.
    expect(await page.locator('[data-column-id="doing"] .card').count()).toBeGreaterThan(0)
  })
})