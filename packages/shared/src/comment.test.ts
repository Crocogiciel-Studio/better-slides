import { describe, expect, it } from 'vitest'
import { MAX_EXCERPT_LENGTH, validateComment } from './comment.ts'

const valid = { slide: 2, text: 'Intro text', selector: 'p:nth-of-type(1)', note: 'Shorten it' }

describe('validateComment', () => {
  it('accepts a well-formed payload', () => {
    expect(validateComment(valid)).toEqual({ ok: true, comment: valid })
  })

  it('keeps an optional source line', () => {
    const r = validateComment({ ...valid, line: 12 })
    expect(r.ok && r.comment.line).toBe(12)
  })

  it.each([
    ['slide', { ...valid, slide: undefined }],
    ['slide', { ...valid, slide: 0 }],
    ['text', { ...valid, text: '  ' }],
    ['selector', { ...valid, selector: undefined }],
    ['note', { ...valid, note: '' }],
    ['line', { ...valid, line: -1 }],
  ])('rejects an invalid %s and names it', (field, input) => {
    const r = validateComment(input)
    expect(r).toMatchObject({ ok: false, field })
  })

  it('rejects a non-object', () => {
    expect(validateComment(null).ok).toBe(false)
  })

  it('truncates a long excerpt', () => {
    const r = validateComment({ ...valid, text: 'x'.repeat(500) })
    expect(r.ok && r.comment.text.length).toBe(MAX_EXCERPT_LENGTH)
  })
})
