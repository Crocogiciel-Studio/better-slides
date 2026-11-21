import type { Agent } from '@better-slide/agents'
import { createApp } from '@better-slide/server'
import { describe, expect, it } from 'vitest'
import { BASE, createClient } from './api.ts'
import { createReviewState, describeActivity, describeReadiness, groupBySlide, hintParts, isPlayMode, summarize } from './reviewState.ts'

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
    const item = (id: string, slide: number) => ({ id, slide, text: 't', selector: 's', note: id, state: 'waiting' as const })
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

  it('counts pending, sendable and finished comments, and clears the finished ones', async () => {
    const { review, released } = state()
    for (const n of ['a', 'b', 'c']) {
      review.select(pick)
      await review.add(n)
    }
    const [a, b, c] = review.comments.value
    review.comments.value = [{ ...a, state: 'done' }, { ...b, state: 'not-done' }, { ...c, state: 'unreported' }]
    expect([review.count.value, review.sendable.value, review.finished.value]).toEqual([1, 1, 2])
    const before = released()
    await review.clearFinished() // the server still has them all waiting: nothing finished there
    expect(review.comments.value.map((i) => i.state)).toEqual(['waiting', 'waiting', 'waiting'])
    expect(released()).toBe(before + 1)
  })
})

describe('describeActivity', () => {
  it('says what the agent does in a few words, with no detail for other tools', () => {
    expect(describeActivity()).toBe('Starting')
    expect(describeActivity({ action: 'read', target: 'slides.md' })).toBe('Reading slides.md')
    expect(describeActivity({ action: 'edit', target: 'pages/a.md' })).toBe('Editing pages/a.md')
    expect(describeActivity({ action: 'search', target: 'Install' })).toBe('Searching "Install"')
    expect(describeActivity({ action: 'edit' })).toBe('Editing')
    expect(describeActivity({ action: 'other', target: 'x' })).toBe('Working')
  })
})

describe('summarize', () => {
  it('counts the outcomes, leaving waiting comments out', () => {
    const item = (state: 'done' | 'not-done' | 'waiting' | 'unreported') => ({ id: '1', slide: 1, text: 't', selector: 's', note: 'n', state })
    expect(summarize([item('done'), item('not-done'), item('done'), item('waiting'), item('unreported')])).toBe('2 done, 1 not done, 1 unconfirmed')
    expect(summarize([item('waiting')])).toBe('')
  })
})

describe('readiness', () => {
  it('describes each readiness and offers a new check only when it helps', () => {
    expect(describeReadiness()).toEqual({ text: 'Checking the agent…', tone: 'muted', recheck: false })
    expect(describeReadiness({ agent: 'Agent', ready: true })).toEqual({ text: 'Agent: ready', tone: 'ok', recheck: false })
    expect(describeReadiness({ agent: 'Agent', ready: false, reason: 'not-logged-in', hint: 'Not logged in: run `x`' })).toEqual({ text: 'Not logged in: run `x`', tone: 'error', recheck: true })
    expect(describeReadiness({ agent: 'Agent', ready: true, reason: 'unknown', hint: 'Not sure' }).tone).toBe('warn')
    expect(hintParts('run `a` then `/b`')).toEqual([{ part: 'run ', code: false }, { part: 'a', code: true }, { part: ' then ', code: false }, { part: '/b', code: true }, { part: '', code: false }])
  })

  it('disables Send when the agent is not ready, and checks again on demand', async () => {
    const { review, released } = state()
    review.select(pick)
    await review.add('x')
    review.readiness.value = { agent: 'Agent', ready: false, reason: 'not-logged-in' }
    expect(review.canSend.value).toBe(false)
    const before = released()
    await review.recheck()
    expect(review.readiness.value).toEqual({ agent: 'fake', ready: true })
    expect(review.canSend.value).toBe(true)
    expect(released()).toBe(before + 1)
  })
})
