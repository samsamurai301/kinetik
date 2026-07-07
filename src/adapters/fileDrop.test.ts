import { describe, it, expect } from 'vitest'
import { attachFileDrop } from './fileDrop.js'

describe('fileDrop adapter', () => {
  it('calls onFiles when files are dropped', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    let received: File[] | null = null
    const handle = attachFileDrop(el, {
      onFiles: (files) => { received = files },
    })
    const data = new DataTransfer()
    data.items.add(new File(['hello'], 'test.txt', { type: 'text/plain' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }))
    expect(received?.length).toBe(1)
    handle.destroy()
  })

  it('calls onReject when accept criteria fails', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    let rejected = false
    const handle = attachFileDrop(el, {
      accept: ['image/*'],
      onFiles: () => { throw new Error('should not be called') },
      onReject: () => { rejected = true },
    })
    const data = new DataTransfer()
    data.items.add(new File(['hello'], 'test.txt', { type: 'text/plain' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }))
    expect(rejected).toBe(true)
    handle.destroy()
  })

  it('emits dragover onDragOverChange', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const events: boolean[] = []
    const handle = attachFileDrop(el, {
      onFiles: () => {},
      onDragOverChange: (over) => events.push(over),
    })
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'a.png', { type: 'image/png' }))
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: data }))
    expect(events).toContain(true)
    expect(handle.isOver()).toBe(true)
    handle.destroy()
  })

  it('respects wildcard image/* accept', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    let received: File[] | null = null
    const handle = attachFileDrop(el, {
      accept: ['image/*'],
      onFiles: (f) => { received = f },
    })
    const data = new DataTransfer()
    data.items.add(new File(['x'], 'photo.png', { type: 'image/png' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }))
    expect(received?.length).toBe(1)
    handle.destroy()
  })
})
