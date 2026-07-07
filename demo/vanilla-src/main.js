import { DragEngine } from '/kinetik-core/core/engine.js'
import { sortableStrategy } from '/kinetik-core/core/collision.js'

const ITEMS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew']
const list = document.getElementById('list')

ITEMS.forEach((label, idx) => {
  const li = document.createElement('li')
  li.dataset.sortableId = String(idx)
  li.textContent = label
  list.appendChild(li)
})

const engine = new DragEngine({
  collisionStrategy: sortableStrategy,
  activationDistance: 5,
  onDragEnd: (state) => {
    if (state.status !== 'dropping') return
    const activeEl = list.querySelector(`[data-sortable-id="${state.activeId}"]`)
    const overEl = state.overId
      ? list.querySelector(`[data-sortable-id="${state.overId}"]`)
      : null
    if (!activeEl || !overEl) return
    if (activeEl !== overEl && overEl.parentNode === activeEl.parentNode) {
      // Sortable: move active into the position of overEl.
      // For a downward drag, active goes after over; for upward, before.
      // Inserting before overEl.nextSibling handles both directions
      // (nextSibling is null when overEl is the last child → append).
      activeEl.parentNode.insertBefore(activeEl, overEl.nextSibling)
    }
  },
})

engine.registerContainer('list', list, ITEMS.map((_, i) => String(i)))
ITEMS.forEach((_label, idx) => {
  const el = list.querySelector(`[data-sortable-id="${idx}"]`)
  engine.registerDraggable(String(idx), el, 'list')
})

engine.subscribe(() => {
  const state = engine.getState()
  list.querySelectorAll('li').forEach((el) => {
    el.classList.toggle('dragging', el.dataset.sortableId === state.activeId)
  })
})

list.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('li')
  if (!li) return
  e.preventDefault()
  engine.beginDrag(li.dataset.sortableId, e)
})
