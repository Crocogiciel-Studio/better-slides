import { describe, expect, it } from 'vitest'
import { createStack, StackLockedError } from './stack.ts'

const c = (note: string) => ({ slide: 1, text: 't', selector: 'p', note })

describe('stack', () => {
  it('keeps order across add, remove and list', () => {
    const s = createStack()
    const [a, b, d] = [s.add(c('a')), s.add(c('b')), s.add(c('d'))]
    expect(s.remove(b.id)).toBe(true)
    expect(s.list().map((i) => i.id)).toEqual([a.id, d.id])
    expect(s.remove('missing')).toBe(false)
  })

  it('refuses changes while locked and accepts them after unlock', () => {
    const s = createStack()
    const a = s.add(c('a'))
    s.lock()
    expect(() => s.add(c('b'))).toThrow(StackLockedError)
    expect(() => s.remove(a.id)).toThrow(StackLockedError)
    s.unlock()
    expect(s.add(c('b')).note).toBe('b')
  })

  it('clear empties and unlocks', () => {
    const s = createStack()
    s.add(c('a'))
    s.lock()
    s.clear()
    expect(s.list()).toEqual([])
    expect(s.locked).toBe(false)
  })
})
