import { describe, expect, it } from 'vitest'
import { createStack, StackLockedError } from './stack.ts'

const c = (note: string, slide = 1) => ({ slide, text: 't', selector: 'p', note })
const states = (s: ReturnType<typeof createStack>) => s.list().map((i) => [i.note, i.state, i.reply])

describe('stack', () => {
  it('keeps order across add, remove and list, new comments waiting', () => {
    const s = createStack()
    const [a, b, d] = [s.add(c('a')), s.add(c('b')), s.add(c('d'))]
    expect(s.remove(b.id)).toBe(true)
    expect(s.list().map((i) => [i.id, i.state])).toEqual([[a.id, 'waiting'], [d.id, 'waiting']])
    expect(s.remove('missing')).toBe(false)
  })

  it('refuses changes while locked and accepts them after unlock', () => {
    const s = createStack()
    const a = s.add(c('a'))
    s.begin()
    expect(() => s.add(c('b'))).toThrow(StackLockedError)
    expect(() => s.remove(a.id)).toThrow(StackLockedError)
    expect(() => s.clearFinished()).toThrow(StackLockedError)
    expect(() => s.begin()).toThrow(StackLockedError)
    s.finish()
    expect(s.add(c('b')).note).toBe('b')
  })

  it('clear empties and unlocks', () => {
    const s = createStack()
    s.add(c('a'))
    s.begin()
    s.clear()
    expect(s.list()).toEqual([])
    expect(s.locked).toBe(false)
  })
})

describe('stack runs', () => {
  function run() {
    const s = createStack()
    const [a, b, d] = [s.add(c('a')), s.add(c('b')), s.add(c('d'))]
    expect(s.begin().map((i) => i.id)).toEqual([a.id, b.id, d.id])
    return { s, a, b, d }
  }

  it('moves a comment to in progress on start, then done or not done with its reply', () => {
    const { s, a, b } = run()
    s.report({ id: a.id, kind: 'start' })
    expect(states(s)[0]).toEqual(['a', 'in-progress', undefined])
    s.report({ id: a.id, kind: 'done', reply: 'Changed' })
    s.report({ id: b.id, kind: 'skipped', reply: 'No data' })
    s.report({ id: a.id, kind: 'start' }) // a start never undoes an outcome
    expect(states(s).slice(0, 2)).toEqual([['a', 'done', 'Changed'], ['b', 'not-done', 'No data']])
  })

  it('applies the last outcome when the agent reports twice', () => {
    const { s, a } = run()
    s.report({ id: a.id, kind: 'skipped', reply: 'first' })
    s.report({ id: a.id, kind: 'done', reply: 'fixed after all' })
    expect(states(s)[0]).toEqual(['a', 'done', 'fixed after all'])
  })

  it('ignores markers for comments outside the run', () => {
    const s = createStack()
    const a = s.add(c('a'))
    expect(s.report({ id: a.id, kind: 'done' })).toBe(false) // no run
    s.begin()
    expect(s.report({ id: '99', kind: 'done' })).toBe(false)
  })

  it('ends a finished run with no comment in progress: unreported ones get the fallback reply', () => {
    const { s, a, b } = run()
    s.report({ id: a.id, kind: 'done', reply: 'ok' })
    s.report({ id: b.id, kind: 'start' })
    s.finish('All applied')
    expect(states(s)).toEqual([['a', 'done', 'ok'], ['b', 'unreported', 'All applied'], ['d', 'unreported', 'All applied']])
    expect(s.locked).toBe(false)
  })

  it('on failure marks the comment in progress failed and leaves the unstarted ones waiting', () => {
    const { s, a, b } = run()
    s.report({ id: a.id, kind: 'done', reply: 'ok' })
    s.report({ id: b.id, kind: 'start' })
    s.fail('boom')
    expect(states(s)).toEqual([['a', 'done', 'ok'], ['b', 'failed', 'boom'], ['d', 'waiting', undefined]])
  })

  it('on cancel puts the comment in progress back to waiting', () => {
    const { s, a, b } = run()
    s.report({ id: a.id, kind: 'skipped', reply: 'no' })
    s.report({ id: b.id, kind: 'start' })
    s.fail('cancelled', true)
    expect(states(s)).toEqual([['a', 'not-done', 'no'], ['b', 'waiting', undefined], ['d', 'waiting', undefined]])
  })

  it('sends again not done, failed and waiting comments, not done or unreported ones, and resets their reply', () => {
    const { s, a, b, d } = run()
    s.report({ id: a.id, kind: 'done', reply: 'ok' })
    s.report({ id: b.id, kind: 'skipped', reply: 'no' })
    s.report({ id: d.id, kind: 'start' })
    s.fail('boom')
    const e = s.add(c('e'))
    expect(s.begin().map((i) => i.id)).toEqual([b.id, d.id, e.id])
    expect(states(s)).toEqual([['a', 'done', 'ok'], ['b', 'waiting', undefined], ['d', 'waiting', undefined], ['e', 'waiting', undefined]])
  })

  it('clear finished removes done and unreported comments only', () => {
    const { s, a, b } = run()
    s.report({ id: a.id, kind: 'done' })
    s.report({ id: b.id, kind: 'skipped' })
    s.finish()
    expect(s.clearFinished()).toBe(2)
    expect(states(s)).toEqual([['b', 'not-done', undefined]])
  })
})
