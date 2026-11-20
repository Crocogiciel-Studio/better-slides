import type { Agent } from '@better-slide/agents'
import { createApp } from '@better-slide/server'
import { describe, expect, it } from 'vitest'
import { BASE, createClient } from './api.ts'
import { createReviewState, groupBySlide, isPlayMode } from './reviewState.ts'

const agent: Agent = { name: 'fake', run: () => ({ cancel() {}, done: new Promise(() => {}) }) }

function state() {
  const app = createApp({ agent, cwd: '/deck' })
  const api = createClient(((url: string, init?: RequestInit) => app.request(url, init)) as unknown as typeof fetch, BASE)
  let released = 0
  return { review: createReviewState(api, () => void released++), released: () => released }
}

const pick = { slide: 2, text: 'Intro', selector: 'h1' }

describe('isPlayMode', () => {
  it('is true on slides and false on presenter, overview, print and export', () => {
    expect(isPlayMode('/2')).toBe(true)
    expect(isPlayMode('/')).toBe(true)
    expect(isPlayMode('/deck/3', '/deck/')).toBe(true)
    for (const p of ['/presenter/2', '/overview', '/notes', '/export', '/print']) expect(isPlayMode(p)).toBe(false)
    expect(isPlayMode('/deck/presenter/2', '/deck/')).toBe(false)
  })
})

describe('groupBySlide', () => {
  it('groups by ascending slide and keeps the order inside a slide', () => {
    const item = (id: string, slide: number) => ({ id, slide, text: 't', selector: 's', note: id })
    const groups = groupBySlide([item('a', 4), item('b', 2), item('c', 4)])
    expect(groups.map((g) => [g.slide, g.items.map((i) => i.id)])).toEqual([[2, ['b']], [4, ['a', 'c']]])
  })
})

describe('review state', () => {
  it('toggles review mode, drops the selection when leaving, and releases the focus', () => {
    const { review, released } = state()
    review.toggle()
    expect(review.open.value).toBe(true)
    review.select(pick)
    review.toggle()
    expect(review.open.value).toBe(false)
    expect(review.pick.value).toBeUndefined()
    expect(released()).toBe(3)
  })

  it('adds a note on the selection, counts it and releases the focus', async () => {
    const { review, released } = state()
    review.select(pick)
    await review.add('Shorter title')
    expect(review.pick.value).toBeUndefined()
    expect(review.count.value).toBe(1)
    expect(review.groups.value[0].items[0].note).toBe('Shorter title')
    expect(released()).toBe(2)
  })

  it('removes a comment', async () => {
    const { review } = state()
    review.select(pick)
    await review.add('x')
    await review.remove(review.comments.value[0].id)
    expect(review.count.value).toBe(0)
  })

  it('locks the stack while sending and releases the focus after send and cancel', async () => {
    const { review, released } = state()
    review.select(pick)
    await review.add('x')
    const before = released()
    await review.send()
    expect(review.locked.value).toBe(true)
    expect(review.canSend.value).toBe(false)
    await review.cancel()
    expect(released()).toBe(before + 2)
  })

  it('shows the server message when sending an empty stack', async () => {
    const { review } = state()
    await review.send()
    expect(review.error.value).toMatch(/empty/)
  })
})
